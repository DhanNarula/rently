"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const AMENITY_OPTIONS = [
  "Parking", "In-suite Laundry", "Dishwasher", "Air Conditioning", "Balcony",
  "Gym", "Elevator", "Pet Friendly", "Utilities Included", "Furnished",
  "Storage", "Rooftop", "Internet Included", "Heat Included",
];

export default function NewUnit() {
  const router = useRouter();
  const { user } = useUser();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    address: "", city: "", province: "ON", postalCode: "",
    rent: "", bedrooms: "1", bathrooms: "1", sqft: "",
    title: "", description: "",
    amenities: [] as string[],
    photos: [] as string[],
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAmenity(a: string) {
    set("amenities", form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);
  }

  async function uploadPhotos(files: FileList) {
    setUploadLoading(true);
    setError("");
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      set("photos", [...form.photos, ...data.urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  async function generateAI() {
    if (!form.address || !form.city || !form.rent) {
      setError("Fill in address, city, and rent first.");
      return;
    }
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form.address, city: form.city, province: form.province,
          rent: form.rent, bedrooms: form.bedrooms, bathrooms: form.bathrooms,
          sqft: form.sqft, amenities: form.amenities,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI generation failed");
      if (data.title) set("title", data.title);
      if (data.description) set("description", data.description);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    if (!form.title || !form.description) { setError("Title and description required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: user?.primaryEmailAddress?.emailAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save unit");
      router.push(`/units/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Add Rental Unit</h1>
          <p className="text-slate-500 text-sm mt-1">Step {step} of 3</p>
          <Progress value={(step / 3) * 100} className="mt-3 h-1.5" />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Street Address</Label>
                <Input className="mt-1" placeholder="123 Main St, Unit 4" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input className="mt-1" placeholder="Toronto" value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label>Province</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.province} onChange={(e) => set("province", e.target.value)}>
                    {["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Postal Code</Label>
                  <Input className="mt-1" placeholder="M5V 2T6" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
                </div>
                <div>
                  <Label>Monthly Rent ($)</Label>
                  <Input className="mt-1" type="number" placeholder="2200" value={form.rent} onChange={(e) => set("rent", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Bedrooms</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)}>
                    {["Studio","1","2","3","4","5+"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Bathrooms</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)}>
                    {["1","1.5","2","2.5","3"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Sqft (optional)</Label>
                  <Input className="mt-1" type="number" placeholder="850" value={form.sqft} onChange={(e) => set("sqft", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Amenities</Label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((a) => (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${form.amenities.includes(a) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-blue-300"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => { if (!form.address || !form.city || !form.rent) { setError("Fill in address, city, and rent."); return; } setError(""); setStep(2); }}>
                Next: Photos
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">Upload at least 3 photos. More photos = better listing. First photo is the cover.</p>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors" onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
                {uploadLoading ? (
                  <div className="text-slate-500">Uploading...</div>
                ) : (
                  <>
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-slate-600 font-medium">Click to upload photos</div>
                    <div className="text-slate-400 text-sm">JPG, PNG, WEBP — up to 20 photos</div>
                  </>
                )}
              </div>

              {form.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {form.photos.map((url, i) => (
                    <div key={url} className="relative group">
                      <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      {i === 0 && <Badge className="absolute top-1 left-1 text-xs bg-blue-600 border-0">Cover</Badge>}
                      <button className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => set("photos", form.photos.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setStep(3)} disabled={form.photos.length === 0}>
                  Next: Listing Text
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Listing Title & Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50" onClick={generateAI} disabled={aiLoading}>
                {aiLoading ? "✨ Writing with AI..." : "✨ Auto-generate with AI"}
              </Button>
              <p className="text-xs text-slate-400 text-center">AI will write a compelling listing — you can edit it below</p>

              <div>
                <Label>Listing Title</Label>
                <Input className="mt-1" placeholder="Spacious 2BR in Downtown Toronto..." value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1 min-h-40" placeholder="Describe the unit, neighbourhood, transit access..." value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : "Save Unit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
