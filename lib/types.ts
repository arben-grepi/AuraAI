export type SignUpForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type Theme = "light" | "dark" | "system";

export type ActionResult<TData = unknown, TError = string> = {
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
  createdAt: string;
  updatedAt: string;
  metadata: { [key: string]: string };
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
