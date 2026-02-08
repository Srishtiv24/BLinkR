import './App.css';
import {Route,BrowserRouter as Router ,Routes} from "react-router-dom";
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import { HomeProvider } from './contexts/HomeContext';
import VideoMeetComponent from './pages/videoMeet';
import HomeComponent from './pages/home';
import HistoryComponent from './pages/history';

function App() {
  return (
    <>
    <Router>
      <AuthProvider>
      <HomeProvider>
      <Routes>
        <Route path="/" element={<LandingPage/>}/>
        <Route path="/auth" element={<Authentication/>}/>
        <Route path="/home" element={<HomeComponent/>}/>
        <Route path="/history" element={<HistoryComponent/>}/>
        <Route path="/:url" element={<VideoMeetComponent/>}/>
      </Routes>
      </HomeProvider>
      </AuthProvider>
    </Router>
    </>
  );
}

export default App;
