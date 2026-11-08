import { Map, Github, Twitter, Linkedin, ArrowUp } from 'lucide-react'

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-slate-950 border-t border-white/5 pt-12 pb-8 px-6 md:px-12 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1">
            <div className="flex items-center gap-2.5 mb-6 group cursor-default">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/10">
                <Map className="text-white w-4.5 h-4.5" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">MapAI</span>
            </div>
            <p className="text-slate-500 font-bold text-xs leading-relaxed mb-6">
              Định vị tương lai qua trí tuệ nhân tạo và bản đồ thông minh.
            </p>
            <div className="flex gap-3">
              {[Github, Twitter, Linkedin].map((Icon, idx) => (
                <a 
                  key={idx}
                  href="#" 
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 col-span-3 gap-8">
            {[
              { title: "Sản phẩm", links: ["Khám phá", "Tính năng", "Bản đồ"] },
              { title: "Hỗ trợ", links: ["API Docs", "Trung tâm", "Tình trạng"] },
              { title: "Công ty", links: ["Bảo mật", "Điều khoản", "Liên hệ"] }
            ].map((section, idx) => (
              <div key={idx}>
                <h4 className="text-white font-black uppercase tracking-[0.2em] text-[9px] mb-5 opacity-40">{section.title}</h4>
                <ul className="space-y-2.5">
                  {section.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-slate-500 hover:text-white font-bold text-xs transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-700">© 2026 MapAI Technologies</span>
          <button 
            onClick={scrollToTop}
            className="text-slate-600 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold"
          >
            TOP <ArrowUp size={12} />
          </button>
        </div>
      </div>
    </footer>
  )
}

export default Footer
