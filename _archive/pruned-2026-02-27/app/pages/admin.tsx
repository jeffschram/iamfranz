import React from 'react';
import AdminArtistForm from '../AdminArtistForm';
import { listArtists } from '../convex/queries';

const AdminPage = () => {
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    const fetchArtists = async () => {
      const data = await listArtists();
      setArtists(data);
    };
    fetchArtists();
  }, []);

  return (
    <div>
      <h1>Admin Panel</h1>
      {artists.map(artist => (
        <AdminArtistForm key={artist._id} artist={artist} />
      ))}
      <AdminArtistForm /> {/* For creating a new artist */}
    </div>
  );
};

export default AdminPage;