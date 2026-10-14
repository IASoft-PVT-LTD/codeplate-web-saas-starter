import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { Card, PageHeader } from '@/components/ui';
import { DeleteAccountForm, PasswordForm, ProfileForm } from '@/components/settings-forms';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-2xl space-y-6">
        <Card><h2 className="mb-4 font-semibold">Profile</h2><ProfileForm name={user.name} email={user.email} /></Card>
        <Card><h2 className="mb-4 font-semibold">Password</h2><PasswordForm /></Card>
        <Card><h2 className="mb-1 font-semibold">Delete account</h2><DeleteAccountForm /></Card>
      </div>
    </>
  );
}
