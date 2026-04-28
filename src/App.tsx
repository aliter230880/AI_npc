import { useStore } from './store/useStore';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import CharactersPage from './pages/CharactersPage';
import ChatPage from './pages/ChatPage';
import CreatePage from './pages/CreatePage';
import ApiDocsPage from './pages/ApiDocsPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const { currentPage } = useStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'landing': return <LandingPage />;
      case 'characters': return <CharactersPage />;
      case 'chat': return <ChatPage />;
      case 'create': return <CreatePage />;
      case 'api-docs': return <ApiDocsPage />;
      case 'dashboard': return <DashboardPage />;
      default: return <LandingPage />;
    }
  };

  // Chat page has its own layout (no navbar needed as it's full screen)
  const showNavbar = currentPage !== 'chat';

  return (
    <div className="noise">
      {showNavbar && <Navbar />}
      <div className="page-enter" key={currentPage}>
        {renderPage()}
      </div>
    </div>
  );
}
