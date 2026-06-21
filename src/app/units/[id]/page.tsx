"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Listing {
  id: string;
  platform: string;
  status: string;
  lastPostedAt: string | null;
  nextPostAt: string | null;
  groupId: string | null;
  groupName: string | null;
}

interface Unit {
  id: string;
  title: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  description: string;
  photos: string;
  videoUrl: string | null;
  isActive: boolean;
  listings: Listing[];
}

export default function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [postOptions, setPostOptions] = useState({ marketplace: true, groups: true });
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch(`/api/units/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setUnit(data);
        setDescription(data.description || "");
        setTitle(data.title || "");
        setLoading(false);
      });
  }, [id]);

  async function saveDescription() {
    const res = await fetch(`/api/units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    setUnit(data);
    setEditingDesc(false);
    setSuccess("Saved.");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function generateVideo() {
    setVideoLoading(true);
    setError("");
    const res = await fetch("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Video generation failed");
    } else {
      setUnit((u) => u ? { ...u, videoUrl: data.videoUrl } : u);
      setSuccess("Video created!");
    }
    setVideoLoading(false);
    setTimeout(() => setSuccess(""), 4000);
  }

  async function postToFacebook() {
    setPosting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: id, postToMarketplace: postOptions.marketplace, postToGroups: postOptions.groups }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Posting failed");

      const messages: string[] = [];
      if (data.marketplace) {
        messages.push(data.marketplace.success ? "Posted to Marketplace!" : `Marketplace: ${data.marketplace.error}`);
      }
      if (data.groups) {
        const ok = data.groups.filter((g: { success: boolean }) => g.success).length;
        messages.push(`Groups: ${ok}/${data.groups.length} posted`);
      }
      setSuccess(messages.join(" · "));

      // Refresh unit to show updated listings
      const refreshed = await fetch(`/api/units/${id}`).then((r) => r.json());
      setUnit(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Posting failed");
    } finally {
      setPosting(false);
      setTimeout(() => setSuccess(""), 6000);
    }
  }

  async function toggleActive() {
    const res = await fetch(`/api/units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !unit?.isActive }),
    });
    const data = await res.json();
    setUnit(data);
  }

  if (loading) return <div className="min-h-screen bg-slate-50"><Nav /><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  if (!unit) return <div className="min-h-screen bg-slate-50"><Nav /><div className="text-center py-20 text-red-500">Unit not found</div></div>;

  const photos: string[] = JSON.parse(unit.photos);
  const marketplaceListing = unit.listings.find((l) => l.platform === "marketplace");
  const groupListings = unit.listings.filter((l) => l.platform === "group");

  function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{unit.title}</h1>
            <p className="text-slate-500 text-sm">{unit.address}, {unit.city}, {unit.province}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={unit.isActive ? "bg-green-100 text-green-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
              {unit.isActive ? "Active" : "Paused"}
            </Badge>
            <Button size="sm" variant="outline" onClick={toggleActive} className="h-7 text-xs">
              {unit.isActive ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="border-green-200 bg-green-50"><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>}

        {/* Photos */}
        {photos.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Photos ({photos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((url, i) => (
                  <img key={url} src={url} alt="" className={`h-20 w-28 object-cover rounded-lg flex-shrink-0 ${i === 0 ? "ring-2 ring-blue-500" : ""}`} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Listing text */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Listing Text</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDesc(!editingDesc)}>
                {editingDesc ? "Cancel" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {editingDesc ? (
              <>
                <div>
                  <Label>Title</Label>
                  <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea className="mt-1 min-h-32" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={saveDescription}>Save Changes</Button>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">{unit.title}</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{unit.description}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Video */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Slideshow Video</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {unit.videoUrl ? (
              <div className="space-y-2">
                <video src={unit.videoUrl} controls className="w-full rounded-lg max-h-48" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generateVideo} disabled={videoLoading}>
                    {videoLoading ? "Generating..." : "Regenerate"}
                  </Button>
                  <a href={unit.videoUrl} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-xs">Download</Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">Create a slideshow video from your photos to post in Facebook Groups.</p>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={generateVideo} disabled={videoLoading || photos.length === 0}>
                  {videoLoading ? "Generating video..." : "Generate Video"}
                </Button>
                {photos.length === 0 && <p className="text-xs text-slate-400 mt-2">Add photos first</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post to Facebook */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm text-blue-700">Post to Facebook</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={postOptions.marketplace} onChange={(e) => setPostOptions((o) => ({ ...o, marketplace: e.target.checked }))} className="rounded" />
                <span className="text-sm font-medium">Marketplace</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={postOptions.groups} onChange={(e) => setPostOptions((o) => ({ ...o, groups: e.target.checked }))} className="rounded" />
                <span className="text-sm font-medium">Rental Groups</span>
              </label>
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={postToFacebook} disabled={posting || (!postOptions.marketplace && !postOptions.groups)}>
              {posting ? "Posting to Facebook... (this takes ~60 seconds)" : "Post to Facebook Now"}
            </Button>
            <p className="text-xs text-slate-400 text-center">After posting, it will automatically repost every 24 hours.</p>
          </CardContent>
        </Card>

        {/* Listing status */}
        {unit.listings.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Posting Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {marketplaceListing && (
                <div className="flex items-center justify-between text-sm py-2">
                  <div className="flex items-center gap-2">
                    <span>FB Marketplace</span>
                    <Badge className={marketplaceListing.status === "active" ? "bg-green-100 text-green-700 border-0 text-xs" : "bg-red-100 text-red-600 border-0 text-xs"}>
                      {marketplaceListing.status}
                    </Badge>
                  </div>
                  <div className="text-slate-400 text-xs">
                    Last: {fmt(marketplaceListing.lastPostedAt)} · Next: {fmt(marketplaceListing.nextPostAt)}
                  </div>
                </div>
              )}
              {groupListings.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm py-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span>Group {l.groupId}</span>
                    <Badge className={l.status === "active" ? "bg-green-100 text-green-700 border-0 text-xs" : "bg-red-100 text-red-600 border-0 text-xs"}>
                      {l.status}
                    </Badge>
                  </div>
                  <div className="text-slate-400 text-xs">Next: {fmt(l.nextPostAt)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
