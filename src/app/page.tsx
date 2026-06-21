import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center text-white">
        <div className="text-6xl mb-6">🏠</div>
        <h1 className="text-5xl font-bold mb-4">Rently</h1>
        <p className="text-xl text-blue-100 mb-3">
          Post your rental to <strong>Facebook Marketplace & Groups</strong> automatically — every single day.
        </p>
        <p className="text-blue-200 mb-10 text-base">
          Upload photos, enter your address, let AI write the listing. We handle the rest — removing and reposting daily so your unit stays at the top.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/sign-up">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 h-12">
              Get Started Free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 h-12">
              Sign In
            </Button>
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-sm text-blue-100">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-semibold text-white">AI-Written Listings</div>
            <div>Compelling descriptions generated automatically</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">🔄</div>
            <div className="font-semibold text-white">Daily Auto-Repost</div>
            <div>Removed and reposted every 24 hours to stay fresh</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl mb-2">🎬</div>
            <div className="font-semibold text-white">Photo Slideshow Video</div>
            <div>Auto-generated video for group posts</div>
          </div>
        </div>
      </div>
    </main>
  );
}
