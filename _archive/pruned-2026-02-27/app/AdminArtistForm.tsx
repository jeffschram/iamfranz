import React, { useState } from 'react';
import { createArtist, updateArtist } from '../convex/mutations';

const AdminArtistForm = ({ artist }) => {
  const [formData, setFormData] = useState(artist || {
    name: '',
    personality: '',
    motivations: [],  // Array for multiple inputs
    interests: [],    // Array for multiple inputs
    style: '',
    mediums: [],
    narrativeVoice: '',
    techSkills: [],
    collabPreference: '',
    emotionalRange: [],
    learningAlgorithm: '',
    ethics: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    artist ? await updateArtist({ id: artist._id, updates: formData }) : await createArtist({ artist: formData });
    // Reset form or close modal
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" value={formData.name} onChange={handleChange} placeholder="Artist Name" />
      <input name="personality" value={formData.personality} onChange={handleChange} placeholder="Personality" />
      {/* Add inputs for other attributes in a similar way */}
      <button type="submit">{artist ? 'Update' : 'Create'} Artist</button>
    </form>
  );  
};

export default AdminArtistForm;