export const apiActors = {
  owner: { userId: "00000000-0000-4000-8000-000000000001", role: "owner", accountStatus: "approved" },
  staff: { userId: "00000000-0000-4000-8000-000000000002", role: "staff", accountStatus: "approved" },
  pending: { userId: "00000000-0000-4000-8000-000000000003", role: "staff", accountStatus: "pending" },
  deactivated: { userId: "00000000-0000-4000-8000-000000000004", role: "staff", accountStatus: "deactivated" },
} as const;

export const apiBaseUrl = "http://localhost:3001/api/v1";
