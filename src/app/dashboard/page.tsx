'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell,
  GraduationCap, 
  Search,
  User,
  RefreshCw,
  Scan,
  ShieldCheck,
  Calendar,
  X,
  ChevronRight,
  LogOut
} from 'lucide-react';

export default function Dashboard() {
  const [profile, setProfile] = React.useState<any>(null);
  const [attendanceData, setAttendanceData] = React.useState<any>(null);
  const [results, setResults] = React.useState<any>(null);
  const [iaMarks, setIaMarks] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  
  const [iaSemesterFilter, setIaSemesterFilter] = React.useState<string>('all');
  const [resSemesterFilter, setResSemesterFilter] = React.useState<string>('all');
  const [attSemesterFilter, setAttSemesterFilter] = React.useState<string>('all');

  const fetchData = async (force = false) => {
    setIsLoading(force ? false : true);
    try {
      const query = force ? '?refresh=true' : '';
      const [profileRes, attendanceRes, resultsRes, iaRes] = await Promise.all([
        fetch(`/api/student/profile${query}`, { cache: 'no-store' }),
        fetch(`/api/student/attendance${query}`, { cache: 'no-store' }),
        fetch(`/api/student/results${query}`, { cache: 'no-store' }),
        fetch(`/api/student/ia-marks${query}`, { cache: 'no-store' })
      ]);
      
      if (profileRes.ok) setProfile(await profileRes.json());
      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        setAttendanceData(data);
        if (data?.semesters?.length > 0 && attSemesterFilter === 'all') {
          setAttSemesterFilter(String(data.semesters[data.semesters.length - 1].semester));
        }
      }
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data);
        if (data?.semesters?.length > 0 && resSemesterFilter === 'all') {
          setResSemesterFilter(String(data.semesters[data.semesters.length - 1].termName));
        }
      }
      if (iaRes.ok) {
        const data = await iaRes.json();
        setIaMarks(data);
        if (data?.semesters?.length > 0 && iaSemesterFilter === 'all') {
          setIaSemesterFilter(String(data.semesters[data.semesters.length - 1].semester));
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const resScrollRef = React.useRef<HTMLDivElement>(null);
  const iaScrollRef = React.useRef<HTMLDivElement>(null);
  const attScrollRef = React.useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null);


  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/';
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-zinc-600 font-bold text-sm tracking-[0.4em]">SYNCING...</motion.div>
      </div>
    );
  }

  const filteredResults = results?.semesters?.flatMap((sem: any) => {
    if (resSemesterFilter !== 'all' && String(sem.termName) !== resSemesterFilter) return [];
    return sem.subjects.map((s: any) => ({ ...s, semester: sem.termName }));
  }) || [];

  const filteredIAMarks = iaMarks?.semesters?.flatMap((sem: any) => {
    if (iaSemesterFilter !== 'all' && String(sem.semester) !== iaSemesterFilter) return [];
    return sem.subjects.map((s: any) => ({ ...s, semester: sem.semester }));
  }) || [];

  const filteredAttendance = attendanceData?.semesters?.flatMap((sem: any) => {
    if (attSemesterFilter !== 'all' && String(sem.semester) !== attSemesterFilter) return [];
    return sem.subjects.map((s: any) => ({ ...s, semester: sem.semester }));
  }) || [];

  const selectedSemData = results?.semesters?.find((s: any) => String(s.termName) === resSemesterFilter);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-zinc-800 pb-20">
      {/* Dynamic Background Blur */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <header className="sticky top-0 bg-black/60 backdrop-blur-2xl z-[100] px-6 py-4 flex items-center justify-between border-b border-white/5">
        <button onClick={() => setIsProfileOpen(true)} className="w-10 h-10 rounded-2xl bg-[#111111] border border-white/10 flex items-center justify-center active:scale-90 transition-all">
          <User className="w-5 h-5 text-white/40" />
        </button>
        <div className="flex-1 text-center">
           <h1 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Academic Hub</h1>
        </div>
        <button onClick={() => fetchData(true)} className="w-10 h-10 rounded-2xl bg-[#111111] border border-white/10 flex items-center justify-center active:scale-90 transition-all">
          <RefreshCw className={`w-5 h-5 text-white/40 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="relative z-10 px-6 pt-8 space-y-8 max-w-lg mx-auto">
        {/* Personalized Student Greeting */}
        <div className="space-y-1">
          <p className="text-xl font-bold text-zinc-500 tracking-wide">Hello,</p>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="capitalize">{profile?.name ? profile.name.toLowerCase() : 'Student'}</span>
            <span className="inline-block origin-bottom-right hover:rotate-12 transition-transform cursor-default">👋</span>
          </h2>
        </div>

        {/* 1. OVERVIEW HERO */}
        <section className="space-y-6">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-white/5 rounded-[2.5rem] blur opacity-50 group-hover:opacity-100 transition duration-1000" />
            <div className="relative bg-[#0a0a0a] rounded-[2.5rem] p-8 border border-white/10 overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32" />
               <div className="space-y-8">
                  <div className="space-y-1 text-center">
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Verified Academic Standing</p>
                    <h1 className="text-8xl font-black tracking-tighter text-white leading-none">{results?.cgpa || '0.0'}</h1>
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em] pt-2">Current CGPA</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 text-center">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Term SGPA</p>
                      <p className="text-lg font-bold text-white">{results?.sgpa || '0.0'}</p>
                    </div>
                    <div className="space-y-1 border-x border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Completed</p>
                      <p className="text-lg font-bold text-white">{results?.semesters?.length || 0} Sems</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Standing</p>
                      <p className="text-lg font-bold text-white">Active</p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* 2. SUMMARY CARDS GRID */}
        <div className="grid grid-cols-1 gap-6">
          {/* Results Summary Card */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => setExpandedSection('results')}
            className="bg-[#0a0a0a] rounded-[2.5rem] p-8 border border-white/5 flex items-center justify-between cursor-pointer group hover:border-white/20 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#141414] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide">Exam Results</h3>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors flex-shrink-0" />
          </motion.div>

          {/* IA Marks Summary Card */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => setExpandedSection('internal')}
            className="bg-[#0a0a0a] rounded-[2.5rem] p-8 border border-white/5 flex items-center justify-between cursor-pointer group hover:border-white/20 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#141414] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform flex-shrink-0">
                <Scan className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide">IA Marks Results</h3>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors flex-shrink-0" />
          </motion.div>

          {/* Attendance Summary Card */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => setExpandedSection('attendance')}
            className="bg-[#0a0a0a] rounded-[2.5rem] p-8 border border-white/5 flex items-center justify-between cursor-pointer group hover:border-white/20 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#141414] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-wide">Attendance</h3>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors flex-shrink-0" />
          </motion.div>
        </div>
      </main>

      {/* DETAILED VIEW MODAL */}
      <AnimatePresence>
        {expandedSection && (
          <div className="fixed inset-0 z-[500] bg-black overflow-hidden flex flex-col">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-0 flex flex-col pt-12"
            >
              <div className="px-6 flex justify-between items-center mb-8 flex-shrink-0">
                <button 
                  onClick={() => setExpandedSection(null)}
                  className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 active:scale-90"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                  {expandedSection === 'results' ? 'Academic Results' : expandedSection === 'internal' ? 'Internal Marks' : 'Subject Attendance'}
                </h2>
                <div className="w-10 h-10" /> {/* Spacer */}
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar">
                {expandedSection === 'results' && (
                  <div className="space-y-8 max-w-lg mx-auto">
                    <div ref={resScrollRef} className="overflow-hidden -mx-6 px-6 relative cursor-grab active:cursor-grabbing select-none">
                      <motion.div drag="x" dragConstraints={resScrollRef} className="flex gap-3 w-max pb-2 pr-12">
                        <button onClick={() => setResSemesterFilter('all')} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${resSemesterFilter === 'all' ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>ALL</button>
                        {results?.semesters?.map((sem: any) => (
                          <button key={sem.termName} onClick={() => setResSemesterFilter(String(sem.termName))} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${resSemesterFilter === String(sem.termName) ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>SEM {sem.termName}</button>
                        ))}
                      </motion.div>
                    </div>

                    {selectedSemData && (
                      <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 rounded-[2.5rem] p-8 border border-blue-500/20 grid grid-cols-2 gap-4 text-center">
                         <div className="space-y-1 border-r border-white/5 pr-4">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Term SGPA</p>
                            <p className="text-4xl font-black text-blue-500">{selectedSemData.sgpa || '0.0'}</p>
                         </div>
                         <div className="space-y-1 pl-4">
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Cum. CGPA</p>
                            <p className="text-4xl font-black text-indigo-400">{selectedSemData.cgpa || results?.cgpa || '0.0'}</p>
                         </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {filteredResults.map((s: any, i: number) => (
                        <div key={i} className="bg-[#0a0a0a] p-6 rounded-[2rem] flex items-center justify-between border border-white/5">
                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-zinc-200 uppercase">{s.name}</h4>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{s.code} • {s.letterGrade} GRADE</p>
                          </div>
                          <p className="text-xl font-black">{s.marksScored}<span className="text-[10px] text-zinc-700 ml-1">/ {s.maxMarks}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedSection === 'internal' && (
                  <div className="space-y-8 max-w-lg mx-auto">
                    <div ref={iaScrollRef} className="overflow-hidden -mx-6 px-6 relative cursor-grab active:cursor-grabbing select-none">
                      <motion.div drag="x" dragConstraints={iaScrollRef} className="flex gap-3 w-max pb-2 pr-12">
                        <button onClick={() => setIaSemesterFilter('all')} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${iaSemesterFilter === 'all' ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>ALL</button>
                        {iaMarks?.semesters?.map((sem: any) => (
                          <button key={sem.semester} onClick={() => setIaSemesterFilter(String(sem.semester))} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${iaSemesterFilter === String(sem.semester) ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>SEM {sem.semester}</button>
                        ))}
                      </motion.div>
                    </div>
                    <div className="space-y-3">
                      {filteredIAMarks.map((s: any, i: number) => (
                        <div key={i} className="bg-[#0a0a0a] p-6 rounded-[2rem] flex items-center justify-between border border-white/5">
                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-zinc-200 uppercase">{s.courseName}</h4>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{s.component}</p>
                          </div>
                          <p className="text-xl font-black">{s.marksScored}<span className="text-[10px] text-zinc-700 ml-1">/ {s.maxMarks}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedSection === 'attendance' && (
                  <div className="space-y-8 max-w-lg mx-auto">
                    <div ref={attScrollRef} className="overflow-hidden -mx-6 px-6 relative cursor-grab active:cursor-grabbing select-none">
                      <motion.div drag="x" dragConstraints={attScrollRef} className="flex gap-3 w-max pb-2 pr-12">
                        <button onClick={() => setAttSemesterFilter('all')} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${attSemesterFilter === 'all' ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>ALL</button>
                        {attendanceData?.semesters?.map((sem: any) => (
                          <button key={sem.semester} onClick={() => setAttSemesterFilter(String(sem.semester))} className={`flex-shrink-0 px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${attSemesterFilter === String(sem.semester) ? 'bg-white text-black' : 'bg-[#111111] text-zinc-600 border border-white/5'}`}>SEM {sem.semester}</button>
                        ))}
                      </motion.div>
                    </div>

                    <div className="space-y-3">
                      {filteredAttendance.map((sub: any, i: number) => (
                        <div key={i} className="bg-[#0a0a0a] p-6 rounded-[2rem] flex justify-between items-center border border-white/5">
                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-zinc-200 uppercase">{sub.subjectName}</h4>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{sub.percentage}% ATTENDED</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${sub.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_15px_currentColor]`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side Profile Drawer */}
      <AnimatePresence>
        {isProfileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 h-full w-[85%] max-w-sm bg-[#050505] z-[201] border-r border-white/5 p-8 flex flex-col">
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Identity</h2>
                <X onClick={() => setIsProfileOpen(false)} className="w-5 h-5 text-zinc-600 cursor-pointer" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center -mt-20">
                <div className="w-40 h-40 rounded-[3rem] bg-gradient-to-br from-zinc-900 to-black border border-white/5 flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden group">
                  <User size={64} className="text-white/5 group-hover:text-blue-500/20 transition-all duration-700" />
                  <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-white">{profile?.name || 'Student Name'}</h3>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{profile?.username || 'UUCMS USER'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-white/5">
                <button onClick={handleLogout} className="w-full py-4 rounded-[1.8rem] bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
