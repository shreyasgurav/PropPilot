import type {
  Lead,
  Property,
  Message,
  FollowUpJob,
  LeadSource,
  LeadStatus,
} from "@prisma/client";

export type { LeadSource, LeadStatus };

export interface LeadListItem extends Lead {
  property: Pick<Property, "id" | "title" | "location"> | null;
}

export interface PropertyListItem extends Property {
  _count: { leads: number };
}

export interface LeadDetail extends Lead {
  property: Property | null;
  messages: Message[];
  followUpJobs: FollowUpJob[];
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiFailure {
  error: string;
}
