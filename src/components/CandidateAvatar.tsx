import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveProfileImage } from '@/lib/candidate-images';
import type { Candidate } from '@/lib/types';
import AvatarActivity from './AvatarActivity';

interface CandidateAvatarProps {
  candidate: Pick<Candidate, 'first_name' | 'last_name' | 'profile_image_url' | 'passport_image_url'> & { id?: string };
  className?: string;
}

const CandidateAvatar: React.FC<CandidateAvatarProps> = ({ candidate, className }) => <Avatar className={`!overflow-visible ${className ?? ''}`} aria-label={`${candidate.first_name} ${candidate.last_name}`}>
  <AvatarImage className="rounded-full object-cover" src={resolveProfileImage(candidate)} alt={`${candidate.first_name} ${candidate.last_name}`} />
  <AvatarFallback>{`${candidate.first_name?.[0] ?? ''}${candidate.last_name?.[0] ?? ''}`.toUpperCase()}</AvatarFallback>
  <AvatarActivity id={candidate.id} kind="candidate" />
</Avatar>;

export default CandidateAvatar;
