import { UploadHookControl } from "better-upload/client";
import { UIMessage } from "ai";

export type SignUpForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type Theme = "light" | "dark" | "system";

export type ActionResult<TData, TError = string> = {
  success: boolean;
  data: TData | null;
  error: TError | null;
};

export type S3ObjectsAPIResponse = {
  items: {
    key: string;
    size: number;
    lastModified: string | null;
    url: string;
  }[];
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  description: string | null;
  backgroundColor: string;
  buttonColor: string;
  createdAt: string;
  updatedAt: string;
  metadata: { [key: string]: string };
  sources: string[];
};

export type OrganizationMembersFilter = {
  organizationId: string;
  limit: number;
  offset: number;
  sortBy: string;
  sortDirection: string;
  filterField: string;
  filterOperator: OrganizationMemberFilterOperators;
  filterValue: string;
};

export type OrganizationMemberFilterOperators =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "contains";

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null | undefined;
  };
};

export type OrganizationMembersResponse = {
  members: OrganizationMember[];
  total: number;
};

export type OrganizationMembersAPIError = {
  error: string;
};

export type User = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null | undefined;
};

export interface UsersWithRole extends User {
  role?: string;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
}

export interface UsersWithRoleResponse {
  users: UsersWithRole[];
  total: number;
  limit: number;
  offset: number;
}

export type UploadDropzoneProps = {
  control: UploadHookControl<true>;
  accept?: string;
  metadata?: Record<string, unknown>;
  description?:
  | {
    fileTypes?: string;
    maxFileSize?: string;
    maxFiles?: number;
  }
  | string;
  uploadOverride?: (
    ...args: Parameters<UploadHookControl<true>["upload"]>
  ) => void;
};

export interface AttachmentMetadata {
  objectKey?: string;
  size?: number;
  organizationId?: string | null;
}

export type MessageFilePart = Extract<UIMessage["parts"][number], { type: "file" }>;

export type PersistedAssistantTextPart = {
  type: "text";
  text: string;
  state: "done";
};
export type PersistedAssistantCitationsPart = {
  type: "citations";
  citations: Record<
    string,
    {
      name: string;
      resourceId: string;
      score: number;
      startOffset?: number;
      endOffset?: number;
    }
  >;
};
export type PersistedAssistantMessagePart =
  | PersistedAssistantTextPart
  | PersistedAssistantCitationsPart;

export type SourceIndexInfo = {
  id: string;
  sourceUrl: string;
  lastIndexedAt: string;
  pagesIndexed: number;
  totalChunks: number;
};
