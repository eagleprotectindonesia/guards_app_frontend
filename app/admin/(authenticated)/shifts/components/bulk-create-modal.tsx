'use client';

import { useState, useTransition, useRef } from 'react';
import Modal from '../../components/modal';
import { bulkCreateShifts } from '../actions';
import toast from 'react-hot-toast';

type BulkCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function BulkCreateModal({ isOpen, onClose }: BulkCreateModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setValidationErrors([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      const result = await bulkCreateShifts(formData);
      if (result.success) {
        toast.success(result.message || 'Shifts created successfully!');
        onClose();
        setFile(null);
        setValidationErrors([]);
      } else {
        setError(result.message || 'Failed to create shifts.');
        if (result.errors && Array.isArray(result.errors)) {
          setValidationErrors(result.errors);
        }
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Create Shifts">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">
            Upload a CSV file with the following columns (headers required):
            <br />
            <code className="text-xs bg-gray-100 p-1 rounded">
              Site Name, Shift Type Name, Date (YYYY-MM-DD), Guard Code
            </code>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
            "
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm max-h-40 overflow-y-auto">
            <p className="font-semibold mb-1">Validation Errors:</p>
            <ul className="list-disc pl-5 space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!file || isPending}
          >
            {isPending ? 'Processing...' : 'Upload & Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
