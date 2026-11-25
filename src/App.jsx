import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-amber-400 border border-amber-400/40 px-6 py-4 rounded-xl">
        Tailwind CSS is Working!
      </h1>
    </div>
    </>
  )
}

export default App
