import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

export default function UserPage() {
  const { username } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:8000/user/${username}`)
      .then(res => setData(res.data))
      .catch(err => console.error("User fetch error:", err));
  }, [username]);

  if (!data) return <div className="p-4">📡 Loading {username}'s page...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">👤 {username}'s Page</h1>
      <p>Total solved: {data.total_solved}</p>

      <h2 className="font-semibold mt-4">By Language</h2>
      <ul>
        {Object.entries(data.by_language).map(([lang, count]) => (
          <li key={lang}>{lang}: {count}</li>
        ))}
      </ul>

      <h2 className="font-semibold mt-4">Recent</h2>
      <ul>
        {data.recent.map((item, i) => (
          <li key={i}>{item.filename} — {new Date(item.timestamp).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
}
