import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { StaffUser } from '@/lib/types';

interface ProfileEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: StaffUser;
  onProfileUpdated: () => void;
}

const ProfileEditorDialog: React.FC<ProfileEditorDialogProps> = ({ isOpen, onClose, staffUser, onProfileUpdated }) => {
  const { actualRole, user } = useAuth();
  const [phone, setPhone] = useState(staffUser.phone_number ?? '');
  const [image, setImage] = useState(staffUser.profile_image_url ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (isOpen) { setPhone(staffUser.phone_number ?? ''); setImage(staffUser.profile_image_url ?? ''); }
  }, [isOpen, staffUser]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const patch = { phone_number: phone, profile_image_url: image };
      if (actualRole === 'superadmin' || actualRole === 'admin') await api.updateStaffProfile(staffUser.id, patch);
      else await api.requestStaffProfileEdit(staffUser.id, patch, user?.email ?? staffUser.email);
      toast.success(actualRole === 'superadmin' || actualRole === 'admin' ? 'Profile updated.' : 'Profile update submitted for approval.');
      onProfileUpdated();
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update profile.'); }
    finally { setSaving(false); }
  };
  return <DialogContent>
    <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="profile-email">Email</Label><Input id="profile-email" value={staffUser.email} disabled /></div>
      <div className="space-y-2"><Label htmlFor="profile-phone">Phone number</Label><Input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="profile-image">Profile image URL</Label><Input id="profile-image" type="url" value={image} onChange={event => setImage(event.target.value)} /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? 'Saving...' : 'Save changes'}</Button></DialogFooter>
    </form>
  </DialogContent>;
};

export default ProfileEditorDialog;
