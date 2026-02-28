"use client";

import { useState, useCallback, useMemo } from "react";
import {
  addGroupMember,
  removeGroupMember,
  searchProfiles,
} from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Member {
  memberId: string;
  role: string;
  member: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

interface SearchResult {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface GroupMemberManagerProps {
  groupId: string;
  ownerId: string;
  members: Member[];
  currentUserId: string;
  onUpdate: () => void;
}

export function GroupMemberManager({
  groupId,
  ownerId,
  members,
  currentUserId,
  onUpdate,
}: GroupMemberManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.memberId)),
    [members]
  );

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const nameA = a.member.fullName ?? "";
        const nameB = b.member.fullName ?? "";
        return nameA.localeCompare(nameB);
      }),
    [members]
  );

  const handleSearch = useCallback(
    async (term: string) => {
      setSearchTerm(term);
      if (term.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchProfiles(term);
        setSearchResults(
          results.filter((r) => !memberIds.has(r.id) && r.id !== currentUserId)
        );
      } catch {
        toast.error("Failed to search profiles");
      } finally {
        setSearching(false);
      }
    },
    [memberIds, currentUserId]
  );

  const handleAdd = async (userId: string) => {
    setAddingId(userId);
    try {
      await addGroupMember(groupId, userId);
      toast.success("Member added");
      setSearchResults((prev) => prev.filter((r) => r.id !== userId));
      onUpdate();
    } catch {
      toast.error("Failed to add member");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeGroupMember(groupId, memberId);
      toast.success("Member removed");
      onUpdate();
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const getInitial = (name: string | null) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <div className="space-y-6">
      {/* Current members */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Members ({members.length})
        </h4>
        <div className="space-y-2">
          {sortedMembers.map((m) => (
            <div
              key={m.memberId}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {getInitial(m.member.fullName)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {m.member.fullName ?? "Unknown"}
                  </span>
                  {m.role === "owner" && (
                    <Badge variant="secondary" className="text-xs">
                      Owner
                    </Badge>
                  )}
                </div>
              </div>
              {m.memberId !== ownerId && m.memberId !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(m.memberId)}
                  disabled={removingId === m.memberId}
                >
                  {removingId === m.memberId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserMinus className="size-4 text-destructive" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search and add */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Add Members
        </h4>
        <Input
          placeholder="Search by name (min 2 characters)..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />

        {searching && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!searching && searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {getInitial(profile.fullName)}
                  </div>
                  <span className="text-sm font-medium">
                    {profile.fullName ?? "Unknown"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAdd(profile.id)}
                  disabled={addingId === profile.id}
                >
                  {addingId === profile.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {!searching && searchTerm.length >= 2 && searchResults.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            No results found
          </p>
        )}
      </div>
    </div>
  );
}
