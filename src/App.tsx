import React, { useEffect, useState } from 'react'
import { Chat } from './pages/ChatPage/ChatPage'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import io from 'socket.io-client'
import { Register } from './pages/RegisterPage/RegisterPage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { TestPage } from './pages/TestPage/TestPage'

const socket = io('http://localhost:10000')

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/test" element={<TestPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
