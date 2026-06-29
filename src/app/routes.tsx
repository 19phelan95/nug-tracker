import { Routes, Route } from 'react-router-dom'
import { HomePage } from '../features/home/HomePage'
import { WorkPage } from '../features/work/WorkPage'
import { LifePage } from '../features/life/LifePage'
import { OvertimePage } from '../features/overtime/OvertimePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/work" element={<WorkPage />} />
      <Route path="/life" element={<LifePage />} />
      <Route path="/overtime" element={<OvertimePage />} />
    </Routes>
  )
}
