'use client';

import { useState, useTransition } from 'react';
import { Guard } from '@prisma/client';
import { Serialized } from '@/lib/utils';
import { deleteGuard } from '../actions';
import GuardFormDialog from './guard-form-dialog';
import toast from 'react-hot-toast';

export default function GuardList({ guards }: { guards: Serialized<Guard>[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Serialized<Guard> | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this guard? This action cannot be undone.')) {
      return;
    }

    startTransition(async () => {
      const result = await deleteGuard(id);
      if (result.success) {
        toast.success('Guard deleted successfully!');
      } else {
        toast.error(result.message || 'Failed to delete guard.');
      }
    });
  };

  const handleEdit = (guard: Serialized<Guard>) => {
    setEditingGuard(guard);
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditingGuard(undefined);
  };

  const showDialog = isCreateOpen || !!editingGuard;

  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guards</h1>
          <p className="text-sm text-gray-500 mt-1">Manage security personnel and contact info.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center h-10 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors shadow-sm shadow-red-500/30"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          Add Guard
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Joined Date</th>
                <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guards.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No guards found. Add one to get started.
                  </td>
                </tr>
              ) : (
                guards.map(guard => (
                  <tr key={guard.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-4 px-6 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {/* Avatar Placeholder */}
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                          {guard.name.substring(0, 2).toUpperCase()}
                        </div>
                        {guard.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-mono">{guard.phone}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(guard.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(guard)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(guard.id)}
                          disabled={isPending}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {isPending ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      {showDialog && <GuardFormDialog isOpen={true} onClose={closeDialog} guard={editingGuard} />}
    </div>
  );
}
