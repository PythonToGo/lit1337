import { useEffect, useState } from "react";
import axios from "axios";

export default function MyPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return;

    axios.get("http://localhost:8000/stats", {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then(res => setStats(res.data))
      .catch(err => console.error("Stats error:", err));
  }, []);

  if (!stats) return <div className="p-4">📊 Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">👤 My Page</h1>
      <p>Total solved: {stats.total_solved}</p>

      <h2 className="font-semibold mt-4">By Language</h2>
      <ul>
        {Object.entries(stats.by_language).map(([lang, count]) => (
          <li key={lang}>
            {lang}: {count}
          </li>
        ))}
      </ul>

      <h2 className="font-semibold mt-4">Recent Activity</h2>
      <ul>
        {stats.recent.map((item, i) => (
          <li key={i}>{item.filename} — {new Date(item.timestamp).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
}
