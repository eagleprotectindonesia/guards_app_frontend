'use server';

import { prisma } from '@/lib/prisma';
import { createGuardSchema, updateGuardSchema, updateGuardPasswordSchema } from '@/lib/validations';
import { hashPassword, serialize, Serialized } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { Guard } from '@prisma/client';
import { parse, isValid } from 'date-fns';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

export type ActionState = {
  message?: string;
  errors?: {
    name?: string[];
    phone?: string[];
    password?: string[];
    confirmPassword?: string[];
    guardCode?: string[];
    status?: string[];
    joinDate?: string[];
    leftDate?: string[];
    note?: string[];
  };
  success?: boolean;
};

export async function getAllGuardsForExport(): Promise<Serialized<Guard>[]> {
  const guards = await prisma.guard.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return serialize(guards);
}

export async function createGuard(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validatedFields = createGuardSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    guardCode: formData.get('guardCode')?.toString() || undefined,
    status: formData.get('status') === 'true' ? true : formData.get('status') === 'false' ? false : undefined,
    joinDate: formData.get('joinDate')?.toString() || undefined,
    leftDate: formData.get('leftDate')?.toString() || undefined,
    note: formData.get('note')?.toString() || undefined,
    password: formData.get('password')?.toString(),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Guard.',
      success: false,
    };
  }

  const { password, ...restData } = validatedFields.data;

  try {
    // Hash the password if provided
    const dataToCreate = {
      ...restData,
      hashedPassword: await hashPassword(password),
    };

    await prisma.guard.create({
      data: dataToCreate,
    });
  } catch (error) {
    // Check for unique constraint violation on phone
    // @ts-expect-error - Prisma error types are tricky to catch explicitly without full types
    if (error.code === 'P2002') {
      return {
        message: 'A guard with this phone number already exists.',
        success: false,
      };
    }

    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to Create Guard.',
      success: false,
    };
  }

  revalidatePath('/admin/guards');
  return { success: true, message: 'Guard created successfully' };
}

export async function updateGuard(id: string, prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validatedFields = updateGuardSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    guardCode: formData.get('guardCode')?.toString() || undefined,
    status: formData.get('status') === 'true' ? true : formData.get('status') === 'false' ? false : undefined,
    joinDate: formData.get('joinDate')?.toString() || undefined,
    leftDate: formData.get('leftDate')?.toString() || undefined,
    note: formData.get('note')?.toString() || undefined,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Guard.',
      success: false,
    };
  }

  try {
    await prisma.guard.update({
      where: { id },
      data: validatedFields.data,
    });
  } catch (error) {
    // @ts-expect-error - Prisma error types are tricky to catch explicitly without full types
    if (error.code === 'P2002') {
      return {
        message: 'A guard with this phone number already exists.',
        success: false,
      };
    }
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to Update Guard.',
      success: false,
    };
  }

  revalidatePath('/admin/guards');
  return { success: true, message: 'Guard updated successfully' };
}

export async function updateGuardPassword(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = updateGuardPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid input. Failed to update password.',
      success: false,
    };
  }

  try {
    const hashedPassword = await hashPassword(validatedFields.data.password);
    await prisma.guard.update({
      where: { id },
      data: { hashedPassword },
    });
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to update password.',
      success: false,
    };
  }

  revalidatePath('/admin/guards');
  return { success: true, message: 'Password updated successfully' };
}

export async function deleteGuard(id: string) {
  try {
    await prisma.guard.delete({
      where: { id },
    });
    revalidatePath('/admin/guards');
    return { success: true };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'Failed to delete guard' };
  }
}

export async function bulkCreateGuards(
  formData: FormData
): Promise<{ success: boolean; message?: string; errors?: string[] }> {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, message: 'No file provided.' };
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    return { success: false, message: 'CSV file is empty or missing data.' };
  }

  const errors: string[] = [];
  const guardsToCreate: any[] = [];
  const phonesToCheck: string[] = [];

  // Skip header row
  const startRow = 1;

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV split, handling basic quotes stripping
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    // Expected: Name, Phone, Guard Code, Note, Join Date, Password
    // At minimum, Name, Phone, Password, and Join Date are required.
    if (cols.length < 3) {
      errors.push(`Row ${i + 1}: Insufficient columns. Name, Phone, Password, and Join Date are required.`);
      continue;
    }

    const [name, phoneRaw, guardCode, note, joinDateStr, password] = cols;
    let phone = phoneRaw;

    if (phone && !phone.startsWith('+')) {
      phone = '+' + phone;
    }

    if (!name || !phone) {
      errors.push(`Row ${i + 1}: Name and Phone are required.`);
      continue;
    }

    // Validate phone number length
    try {
      const phoneNumberObj = parsePhoneNumberWithError(phone);
      if (phoneNumberObj.nationalNumber.length < 6 || phoneNumberObj.nationalNumber.length > 17) {
        errors.push(`Row ${i + 1}: Phone number must be between 6 and 17 characters.`);
        continue;
      }
    } catch {
      errors.push(`Row ${i + 1}: Invalid phone number format.`);
      continue;
    }

    if (!password) {
      errors.push(`Row ${i + 1}: Password is required.`);
      continue;
    }

    if (!joinDateStr) {
      errors.push(`Row ${i + 1}: Join Date is required.`);
      continue;
    }

    // Prepare data for validation
    let joinDateISO: string | undefined = undefined;
    if (joinDateStr) {
      let d: Date | undefined;
      const cleanDateStr = joinDateStr.trim();

      // Try standard Date constructor first (handles ISO yyyy-MM-dd)
      const tryDate = new Date(cleanDateStr);
      // Valid if not NaN and year is reasonable (e.g. > 1900) to avoid "Invalid Date"
      if (!isNaN(tryDate.getTime())) {
        d = tryDate;
      } else {
        // Fallback to specific formats common in CSVs using date-fns
        const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy'];
        for (const fmt of formats) {
          const parsed = parse(cleanDateStr, fmt, new Date());
          if (isValid(parsed)) {
            d = parsed;
            break;
          }
        }
      }

      if (!d || isNaN(d.getTime())) {
        errors.push(
          `Row ${i + 1}: Invalid Join Date '${joinDateStr}'. Expected YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY.`
        );
        continue;
      }
      joinDateISO = d.toISOString();
    }

    // Validate guard code if provided
    let guardCodeValue: string | undefined = undefined;
    if (guardCode) {
      if (!/^[a-zA-Z0-9]*$/.test(guardCode)) {
        errors.push(`Row ${i + 1}: Guard code must be alphanumeric only.`);
        continue;
      }
      if (guardCode.length > 12) {
        errors.push(`Row ${i + 1}: Guard code must be at most 12 characters.`);
        continue;
      }
      guardCodeValue = guardCode;
    }

    const inputData = {
      name,
      phone,
      guardCode: guardCodeValue,
      note: note || undefined,
      joinDate: joinDateISO,
      password: password,
    };

    // Use schema for validation
    const validationResult = createGuardSchema.safeParse(inputData);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;
      const errorMsg = Object.entries(fieldErrors)
        .map(([field, errs]) => `${field}: ${errs?.join(', ')}`)
        .join('; ');
      errors.push(`Row ${i + 1}: ${errorMsg}`);
      continue;
    }

    if (phonesToCheck.includes(phone)) {
      errors.push(`Row ${i + 1}: Duplicate phone number '${phone}' in file.`);
      continue;
    }

    phonesToCheck.push(phone);

    // Hash the password for this specific guard
    const hashedPasswordForGuard = await hashPassword(validationResult.data.password);

    guardsToCreate.push({
      name: validationResult.data.name,
      phone: validationResult.data.phone,
      guardCode: validationResult.data.guardCode,
      note: validationResult.data.note,
      joinDate: validationResult.data.joinDate, // This is ISO string
      hashedPassword: hashedPasswordForGuard, // Use the password from CSV
      status: true, // Default to active
    });
  }

  if (errors.length > 0) {
    return { success: false, message: 'Validation failed.', errors };
  }

  if (guardsToCreate.length === 0) {
    return { success: false, message: 'No valid guards found to create.' };
  }

  try {
    // Check for existing phones in DB
    const existingGuards = await prisma.guard.findMany({
      where: {
        phone: { in: phonesToCheck },
      },
      select: { phone: true },
    });

    if (existingGuards.length > 0) {
      const existingPhones = existingGuards.map(g => g.phone);
      return {
        success: false,
        message: 'Some phone numbers already exist in the database.',
        errors: existingPhones.map(p => `Phone '${p}' is already registered.`),
      };
    }

    const finalData = guardsToCreate.map(g => ({
      ...g,
      joinDate: g.joinDate ? new Date(g.joinDate) : undefined,
    }));

    await prisma.guard.createMany({
      data: finalData,
    });

    revalidatePath('/admin/guards');
    return { success: true, message: `Successfully created ${guardsToCreate.length} guards.` };
  } catch (error) {
    console.error('Bulk Create Error:', error);
    return { success: false, message: 'Database error during bulk creation.' };
  }
}
