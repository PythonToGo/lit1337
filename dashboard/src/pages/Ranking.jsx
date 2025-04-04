import { useEffect, useState } from "react";
import axios from "axios";

export default function Ranking() {
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/ranking")
      .then(res => setRanking(res.data.ranking))
      .catch(err => console.error("Ranking fetch error:", err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">🏆 Ranking Board</h1>

      <table className="table-auto w-full border border-gray-300">
        <thead className="bg-blue-300">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Username</th>
            <th className="p-2 text-left">Total Solved</th>
            <th className="p-2 text-left">Total Point</th>
            <th className="p-2 text-left">Languages</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((user, idx) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{idx + 1}</td>
              <td className="p-2">{user.username || "Anonymous"}</td>
              <td className="p-2">{user.total_solved}</td>
              <td className="p-2">{user.total_point}</td>
              <td className="p-2">
                {Object.entries(user.by_language).map(([lang, count]) => (
                  <span key={lang} className="inline-block bg-blue-500 text-sm rounded px-2 py- mr-1 mb-1">
                    {lang}: {count}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

