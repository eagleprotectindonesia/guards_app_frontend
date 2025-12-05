'use client';

import Modal from '../../components/modal';
import { createSite, updateSite, ActionState } from '../actions';
import { useActionState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Select from '../../components/select'; // Import the custom Select component

type Site = {
  id: string;
  name: string;
  timeZone: string;
};

type Props = {
  site?: Site; // If provided, it's an edit form
  isOpen: boolean;
  onClose: () => void;
};

const timeZoneOptions = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  // Add more as needed, or use a full list
];

export default function SiteFormDialog({ site, isOpen, onClose }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    site ? updateSite.bind(null, site.id) : createSite,
    { success: false }
  );

  useEffect(() => {
    if (state.success) {
      toast.success(state.message || (site ? 'Site updated successfully!' : 'Site created successfully!'));
      onClose();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, onClose, site]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={site ? 'Edit Site' : 'Create New Site'}>
      <form action={formAction} className="space-y-4 p-4">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Site Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            defaultValue={site?.name || ''}
            className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
            placeholder="e.g. Warehouse A"
          />
          {state.errors?.name && <p className="text-red-500 text-xs mt-1">{state.errors.name[0]}</p>}
        </div>

        {/* TimeZone Field */}
        <div>
          <label htmlFor="timeZone" className="block text-sm font-medium text-gray-700 mb-1">
            Time Zone
          </label>
          <Select
            id="timeZone"
            instanceId="timeZone"
            name="timeZone" // Important for form submission
            options={timeZoneOptions}
            defaultValue={timeZoneOptions.find(option => option.value === (site?.timeZone || 'UTC'))}
            isClearable={false}
            isSearchable={false}
            // react-select's onChange provides the selected option object, not just the value.
            // For form submission, we need the value to be passed as part of the FormData.
            // The `name` prop will handle this automatically for simple value selects.
          />
          {state.errors?.timeZone && <p className="text-red-500 text-xs mt-1">{state.errors.timeZone[0]}</p>}
        </div>

        {/* Error Message */}
        {state.message && !state.success && (
          <div className="p-3 rounded bg-red-50 text-red-600 text-sm">{state.message}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-32">
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
            {isPending ? 'Saving...' : site ? 'Save Changes' : 'Create Site'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
