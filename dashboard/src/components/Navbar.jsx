import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-gray-900 text-white px-4 py-3 flex gap-4">
      <Link to="/" className="hover:underline">🏠 Home</Link>
      <Link to="/ranking" className="hover:underline">🏆 Ranking</Link>
      <Link to="/search" className="hover:underline">🔍 Search</Link>
      <Link to="/mypage" className="hover:underline">👤 My Page</Link>
    </nav>
  );
}
