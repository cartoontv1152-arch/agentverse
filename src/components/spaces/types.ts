export interface SpaceMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  nexconnId: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface SpaceAgent {
  id: string;
  kind: "builtin" | "custom";
  builtinKey: string | null;
  ownerId: string | null;
  name: string;
  handle: string;
  tagline: string;
  instructions: string;
  tools: string[];
  avatarUrl: string | null;
  nexconnId: string;
  enabled: boolean;
}

export interface Usage {
  used: number;
  limit: number;
  resetsAt: string | null;
}

export interface SpaceDetail {
  space: {
    id: string;
    name: string;
    description: string;
    nexconnGroupId: string;
    ownerId: string;
    replyMode: "mention" | "auto";
    requireApproval: boolean;
    createdAt: string;
  };
  role: "owner" | "member";
  lastReadAt: string;
  members: SpaceMember[];
  agents: SpaceAgent[];
  usage: { user: Usage; space: Usage | null };
}
