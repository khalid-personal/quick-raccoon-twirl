// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getAttendanceRecords, initializeDataStore, saveAttendanceRecords } from '@/lib/data-store';
import { checkIn, checkOut } from '@/lib/api/attendance-management';

describe('automatic attendance sessions', () => {
  beforeEach(() => {
    localStorage.clear();
    initializeDataStore();
    saveAttendanceRecords([]);
  });

  it('reuses the open attendance record on repeated sign-in', async () => {
    const first = await checkIn('staff-1', 'staff@example.test');
    const second = await checkIn('staff-1', 'staff@example.test');

    expect(second.id).toBe(first.id);
    expect(getAttendanceRecords()).toHaveLength(1);
    expect(getAttendanceRecords()[0].check_out_time).toBeUndefined();
  });

  it('closes the active attendance record on sign-out', async () => {
    const started = await checkIn('staff-1', 'staff@example.test');
    const ended = await checkOut('staff-1', 'staff@example.test');

    expect(ended.id).toBe(started.id);
    expect(ended.check_out_time).toBeTruthy();
    expect(getAttendanceRecords()).toHaveLength(1);
  });
});
