
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Search() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const searchUser = async () => {
        if (!query) return;

        try {
            setLoading(true);
            const res = await axios.get(`http://localhost:8000/search?username=${query}`);
            setResults(res.data.results);
            setLoading(false);
        } catch (err) {
            console.error("Search error:", err);
            setLoading(false);
        }
    };
    
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-2">🔍 Search User</h2>
            <input
                className="boarder px-2 py-1 mr-2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Username"
            />
            <button className="bg-blue-300 text-white px-3 py-1 rounded" onClick={searchUser}>
                Search
            </button>

            <ul className="mt-4">
                {results.map((user, i) => (
                    <li
                        key={i}
                        className="cursor-pointer hover:bg-gray-100 p-2 rounded"
                        onClick={() => navigate(`/user/${user.username}`)}
                    >
                        {user.username} - {user.total_solved} solved
                    </li>
                ))}
                {loading ? (
                    <p>🔍 Loading...</p>
                    ) : results.length === 0 ? (
                    <p>😕 No results found.</p>
                    ) : (
                    results.map((user) => (
                        <div key={user.username}>
                        <p>👤 {user.username}</p>
                        <p>✅ {user.total_solved} solved</p>
                        </div>
                    ))
                )}

            </ul>
        </div>
    );
}