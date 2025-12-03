'use client';

import Modal from '../../components/modal';
import { createGuard, updateGuard, ActionState } from '../actions';
import { useActionState, useEffect } from 'react';
import toast from 'react-hot-toast';

type Guard = {
  id: string;
  name: string;
  phone: string;
};

type Props = {
  guard?: Guard; // If provided, it's an edit form
  isOpen: boolean;
  onClose: () => void;
};

export default function GuardFormDialog({ guard, isOpen, onClose }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    guard ? updateGuard.bind(null, guard.id) : createGuard,
    { success: false }
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.message || (guard ? 'Guard updated successfully!' : 'Guard created successfully!'));
      onClose();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, onClose, guard]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={guard ? 'Edit Guard' : 'Add New Guard'}
    >
      <form action={formAction} className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            defaultValue={guard?.name || ''}
            className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
            placeholder="e.g. John Doe"
          />
          {state.errors?.name && (
            <p className="text-red-500 text-xs mt-1">{state.errors.name[0]}</p>
          )}
        </div>

        {/* Phone Field */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            id="phone"
            defaultValue={guard?.phone || ''}
            className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
            placeholder="e.g. +15550123456"
          />
          {state.errors?.phone && (
            <p className="text-red-500 text-xs mt-1">{state.errors.phone[0]}</p>
          )}
        </div>

        {/* Error Message */}
        {state.message && !state.success && (
          <div className="p-3 rounded bg-red-50 text-red-600 text-sm">{state.message}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-500/30"
          >
            {isPending ? 'Saving...' : guard ? 'Save Changes' : 'Add Guard'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
