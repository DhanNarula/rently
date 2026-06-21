"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Group {
  id: string;
  name: string;
}

interface FbAccount {
  id: string;
  email: string;
  groups: Group[];
}

export default function Settings() {
  const [account, setAccount] = useState<FbAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    fetch("/api/fb-account")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setAccount(data);
          setEmail(data.email);
          setGroups(data.groups || []);
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    if (!email || !password) { setError("Email and password required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/fb-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, groups }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAccount(data);
      setPassword("");
      setSuccess("Facebook account saved!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Remove your Facebook account?")) return;
    await fetch("/api/fb-account", { method: "DELETE" });
    setAccount(null);
    setEmail("");
    setPassword("");
    setGroups([]);
  }

  function addGroup() {
    if (!newGroupId.trim()) return;
    const id = newGroupId.trim().replace(/.*facebook\.com\/groups\//i, "").replace(/\/.*/,"");
    setGroups((g) => [...g, { id, name: newGroupName.trim() || id }]);
    setNewGroupId("");
    setNewGroupName("");
  }

  function removeGroup(gid: string) {
    setGroups((g) => g.filter((x) => x.id !== gid));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="border-green-200 bg-green-50"><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Facebook Account</span>
              {account && <Badge className="bg-green-100 text-green-700 border-0">Connected</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800 text-sm">
                Your credentials are encrypted with AES-256-GCM before storage. We never store your password in plain text.
                However, be aware this automation logs into your real Facebook account — use with care.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Facebook Email</Label>
              <Input className="mt-1" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>{account ? "New Password (leave blank to keep existing)" : "Facebook Password"}</Label>
              <Input className="mt-1" type="password" placeholder={account ? "••••••••" : "Your Facebook password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <Button className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={save} disabled={saving || (!password && !account)}>
                {saving ? "Saving..." : account ? "Update Account" : "Save Account"}
              </Button>
              {account && (
                <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={disconnect}>
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facebook Rental Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Add the Facebook Groups you want to post your listings to. You must be a member of these groups.
              Paste the group URL or just the group ID (the part after /groups/).
            </p>

            {groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{g.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{g.id}</span>
                    </div>
                    <button onClick={() => removeGroup(g.id)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="border rounded-lg p-3 space-y-3">
              <div>
                <Label>Group URL or ID</Label>
                <Input className="mt-1" placeholder="facebook.com/groups/torontorentals or 123456789" value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)} />
              </div>
              <div>
                <Label>Group Nickname (optional)</Label>
                <Input className="mt-1" placeholder="Toronto Rentals" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={addGroup} disabled={!newGroupId.trim()}>
                + Add Group
              </Button>
            </div>

            {groups.length > 0 && (
              <Button className="bg-blue-600 hover:bg-blue-700 w-full" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Groups"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>How Daily Reposting Works</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>Once you post a listing, Rently schedules an automatic repost every 24 hours:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-500">
              <li>The existing Marketplace listing is removed</li>
              <li>A fresh listing is created — back at the top of search results</li>
              <li>New posts are made to all your rental groups</li>
            </ol>
            <p className="text-slate-400 text-xs mt-3">
              The cron job runs at midnight UTC. You can also manually trigger a repost from the unit page at any time.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
