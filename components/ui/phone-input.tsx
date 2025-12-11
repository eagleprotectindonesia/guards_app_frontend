'use client';

import React, { useState } from 'react';
import PhoneInputWithCountrySelect, { Value } from 'react-phone-number-input';
import 'react-phone-number-input/style.css'; // Import the default styles

interface PhoneInputProps {
  id?: string;
  inputName: string; // Renamed 'name' to 'inputName'
  defaultValue?: Value;
  className?: string;
  placeholder?: string;
  onChange?: (value: Value) => void;
}

const PhoneInput: React.FC<PhoneInputProps> = ({ id, inputName, defaultValue, className, placeholder, onChange }) => {
  const [value, setValue] = useState<Value | undefined>(defaultValue);

  const handleChange = (newValue: Value) => {
    setValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <PhoneInputWithCountrySelect
      id={id}
      name={inputName} // Use inputName here for the actual input field
      international
      defaultCountry="ID"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      countryCallingCodeEditable={false}
      className={`w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all ${className}`}
    />
  );
};

export default PhoneInput;
