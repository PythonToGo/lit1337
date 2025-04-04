import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import MyPage from "./pages/MyPage";
import Search from "./pages/Search";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </Router>
  );
}
