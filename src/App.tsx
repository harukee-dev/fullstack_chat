import { Chat } from './pages/ChatPage/ChatPage'
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  HashRouter,
} from 'react-router-dom'
import { Register } from './pages/RegisterPage/RegisterPage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { TestPage } from './pages/TestPage/TestPage'
import { Room } from './components/Room/Room'
import { SocketProvider } from './SocketContext'

function App() {
  return (
    <SocketProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
          <Route path="/main/*" element={<Chat />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/test/room/:id" element={<Room />} />
        </Routes>
      </HashRouter>
    </SocketProvider>
  )
}

export default App
