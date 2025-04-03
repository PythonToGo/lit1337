import { useEffect, useState } from "react";
import axios from "axios";

export default function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return;

    axios.get("http://localhost:8000/stats", {
      headers: { Authorization: `Bearer ${jwt}` }
    }).then(res => setStats(res.data))
      .catch(err => console.error("Stats error:", err));
  }, []);

  if (!stats) return <div className="p-4">📊 Loading stats...</div>;

return (
  <div className="p-4">
    <h1 className="text-xl font-bold">📈 Your Stats</h1>
    <p>Total Solved: {stats.total_solved}</p>

    {stats.total_solved === 0 ? (
      <p className="mt-4 text-gray-500">You haven't solved any problems yet. Go solve one! 😎</p>
    ) : (
      <>
        <p>Total Languages: {Object.keys(stats.by_language).length}</p>
        <ul className="mt-2">
          {Object.entries(stats.by_language).map(([lang, count]) => (
            <li key={lang}>- {lang}: {count} problems</li>
          ))}
        </ul>
      </>
    )}
    </div>
  );
}
