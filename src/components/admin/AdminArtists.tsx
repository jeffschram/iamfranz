import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type ArtistFormData = {
  name: string;
  bio: string;
  website: string;
  instagram: string;
  email: string;
};

const EMPTY_FORM: ArtistFormData = {
  name: "",
  bio: "",
  website: "",
  instagram: "",
  email: "",
};

export function AdminArtists() {
  const artists = useQuery(api.artists.list);
  const createArtist = useMutation(api.artists.create);
  const updateArtist = useMutation(api.artists.update);
  const removeArtist = useMutation(api.artists.remove);
  const generateUploadUrl = useMutation(api.artists.generateUploadUrl);

  const [showForm, setShowForm] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Id<"artists"> | null>(null);
  const [formData, setFormData] = useState<ArtistFormData>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      bio: formData.bio || undefined,
      website: formData.website || undefined,
      instagram: formData.instagram || undefined,
      email: formData.email || undefined,
    };

    if (editingArtist) {
      await updateArtist({ id: editingArtist, ...payload });
    } else {
      await createArtist(payload);
    }

    resetForm();
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    artistId: Id<"artists">,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await result.json();
      await updateArtist({
        id: artistId,
        profileImage: storageId,
      });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setShowForm(false);
    setEditingArtist(null);
  };

  const startEdit = (artist: any) => {
    setFormData({
      name: artist.name || "",
      bio: artist.bio || "",
      website: artist.website || "",
      instagram: artist.instagram || "",
      email: artist.email || "",
    });
    setEditingArtist(artist._id);
    setShowForm(true);
  };

  if (!artists) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-black">Manage Artists</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          Add Artist
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingArtist ? "Edit Artist" : "Add New Artist"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                placeholder="Website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                placeholder="Instagram"
                type="text"
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                placeholder="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <p className="text-xs text-gray-500">
              Agent-managed profile fields (personality, style, motivations, interests, etc.) are updated by the autonomous pipeline.
            </p>

            <div className="flex space-x-4">
              <button type="submit" className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors">
                {editingArtist ? "Update" : "Create"} Artist
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artists.map((artist) => (
          <div key={artist._id} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
              {artist.profileImageUrl ? (
                <img src={artist.profileImageUrl} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
              )}
            </div>

            <h3 className="font-semibold text-lg text-black mb-1">{artist.name}</h3>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{artist.bio || "No bio yet"}</p>
            <p className="text-xs text-gray-500 mb-1">Agent profile: {artist.personality || "managed by pipeline"}</p>
            <p className="text-xs text-gray-500 mb-3">Style: {artist.style || "managed by pipeline"}</p>

            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, artist._id)}
                className="text-xs"
                disabled={uploading}
              />

              <div className="flex space-x-2">
                <button
                  onClick={() => startEdit(artist)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeArtist({ id: artist._id })}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
