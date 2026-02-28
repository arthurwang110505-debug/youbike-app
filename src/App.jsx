import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, 
  RefreshCw, 
  MapPin, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  ArrowRightLeft,
  ChevronRight,
  Info,
  Sparkles,
  Bot,
  X,
  Compass,
  Calendar,
  Wallet,
  ShieldCheck,
  ExternalLink,
  LocateFixed,
  LocateOff,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

// --- API 常數 ---
// 本機開發：走 vite proxy（/api/youbike → 真實 API，解決 CORS）
// 生產環境（Vercel）：走 /api/youbike serverless function
const API_URL = "/api/youbike";

// ⚠️ 將這裡換成你的 Gemini API Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- 主題色設定 ---
// mode: 'dark' | 'light' | 'system'
const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const themes = {
  dark: {
    bg: 'bg-slate-950',
    bgCard: 'bg-slate-900/60',
    bgCardSolid: 'bg-slate-900',
    bgInner: 'bg-slate-950/40',
    bgBtn: 'bg-slate-800/50',
    bgBtnSolid: 'bg-slate-800',
    bgBtnHover: 'hover:bg-slate-700',
    bgTab: 'bg-slate-900/80',
    bgModal: 'bg-slate-900',
    bgRadius: 'bg-slate-900/60',
    bgRadiusActive: 'bg-slate-600',
    border: 'border-slate-800',
    borderCard: 'border-slate-800/80',
    borderInner: 'border-white/5',
    borderBtn: 'border-slate-700/50',
    text: 'text-slate-100',
    textSub: 'text-slate-500',
    textMuted: 'text-slate-400',
    textBtn: 'text-slate-300',
    glow1: 'bg-indigo-600/20',
    glow2: 'bg-purple-600/10',
    modalOverlay: 'bg-slate-950/80',
    divider: 'border-slate-800/60',
    skeletonBase: 'bg-slate-900/40',
    skeletonItem: 'bg-slate-800',
    skeletonInner: 'bg-slate-800/50',
  },
  light: {
    bg: 'bg-slate-100',
    bgCard: 'bg-white/80',
    bgCardSolid: 'bg-white',
    bgInner: 'bg-slate-100/80',
    bgBtn: 'bg-white/70',
    bgBtnSolid: 'bg-white',
    bgBtnHover: 'hover:bg-slate-200',
    bgTab: 'bg-white/90',
    bgModal: 'bg-white',
    bgRadius: 'bg-white/80',
    bgRadiusActive: 'bg-slate-300',
    border: 'border-slate-200',
    borderCard: 'border-slate-200/80',
    borderInner: 'border-slate-200',
    borderBtn: 'border-slate-300',
    text: 'text-slate-900',
    textSub: 'text-slate-400',
    textMuted: 'text-slate-500',
    textBtn: 'text-slate-600',
    glow1: 'bg-indigo-300/20',
    glow2: 'bg-purple-300/10',
    modalOverlay: 'bg-slate-900/50',
    divider: 'border-slate-200',
    skeletonBase: 'bg-slate-200/60',
    skeletonItem: 'bg-slate-200',
    skeletonInner: 'bg-slate-200/70',
  },
};

// --- 地理位置工具函式 ---

/**
 * 取得使用者位置，回傳 Promise<{lat, lng}>
 * 支援所有裝置：桌面、Android Chrome、iOS Safari
 * 
 * iOS 注意：必須是 HTTPS 才能使用 geolocation
 */
const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("此裝置或瀏覽器不支援地理定位"));
      return;
    }

    // 先用「快速但不精確」模式嘗試取得快取位置
    // 再用「精確」模式取得真實位置
    let resolved = false;

    // 第一次嘗試：快取優先（快速回應）
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      (err) => {
        // 快取失敗，等精確模式
        console.warn("快取定位失敗:", err.message);
      },
      {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 30000 // 允許 30 秒內的快取
      }
    );

    // 第二次嘗試：精確位置（稍慢但真實）
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolved = true; // 無論如何都覆蓋成最新精確位置
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (!resolved) {
          // 兩次都失敗
          let msg = "無法取得位置";
          switch (err.code) {
            case err.PERMISSION_DENIED:
              msg = "位置權限被拒絕，請至瀏覽器設定開啟";
              break;
            case err.POSITION_UNAVAILABLE:
              msg = "裝置無法判斷目前位置";
              break;
            case err.TIMEOUT:
              msg = "定位逾時，請確認 GPS 已開啟";
              break;
          }
          reject(new Error(msg));
        }
      },
      {
        enableHighAccuracy: true,  // 使用 GPS（行動裝置）
        timeout: 10000,            // 最多等 10 秒
        maximumAge: 0              // 不使用快取，要最新位置
      }
    );
  });
};

const App = () => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // 'idle' | 'asking' | 'loading' | 'success' | 'error' | 'denied'
  const [locationError, setLocationError] = useState('');
  const [activeTab, setActiveTab] = useState('full');
  const [lastUpdated, setLastUpdated] = useState('');
  const [radius, setRadius] = useState(1); // 公里，預設 1km
  
  // Modal 狀態
  const [aiInsight, setAiInsight] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // 1. 初始化：只抓資料，不自動要位置
  useEffect(() => {
    handleRefresh();
    // 詢問使用者是否願意開啟定位
    setLocationStatus('asking');
  }, []);

  /**
   * 使用者點「允許」後才呼叫
   */
  const requestLocation = async () => {
    setLocationStatus('loading');
    setLocationError('');
    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
      setLocationStatus('success');
    } catch (err) {
      console.error("定位失敗:", err.message);
      setLocationError(err.message);
      setLocationStatus('error');
    }
  };

  /**
   * 使用者選擇不開啟定位
   */
  const handleDenyLocation = () => {
    setLocationStatus('denied');
  };

  const handleRefresh = async () => {
    setLoading(true);
    setAiInsight(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`網路連線錯誤 (${res.status})`);
      const data = await res.json();
      setStations(data);
      setLastUpdated(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch (err) {
      console.error("抓取失敗", err);
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  // 2. 距離計算（Haversine 公式）
  const calculateDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const [isFallbackMode, setIsFallbackMode] = useState(false);

  const processedStations = useMemo(() => {
    let list = [...stations];
    if (userLocation) {
      list = list.map(s => ({
        ...s,
        dist: calculateDist(
          userLocation.lat, userLocation.lng,
          parseFloat(s.latitude), parseFloat(s.longitude)
        )
      })).sort((a, b) => (a.dist || 0) - (b.dist || 0));
    }

    // act 欄位可能是數字 1 或字串 "1"，用 == 寬鬆比較
    // 有定位時只顯示方圓 1 公里內的站點
    const nearby = userLocation
      ? list.filter(s => s.dist <= radius && s.act == 1)
      : list.filter(s => s.act == 1);

    let filtered;
    if (activeTab === 'nearby') {
      // 附近站點：方圓 1 公里內所有啟用中的站點
      setIsFallbackMode(false);
      return nearby.slice(0, 15);
    } else if (activeTab === 'full') {
      // 需借車站：完全沒有空位（滿站），借出可領獎勵
      filtered = nearby.filter(s => s.available_return_bikes === 0).slice(0, 15);
    } else {
      // 需還車站：完全沒有車可借（空站），還入可領獎勵
      filtered = nearby.filter(s => s.available_rent_bikes === 0).slice(0, 15);
    }

    if (filtered.length === 0 && nearby.length > 0) {
      setIsFallbackMode(true);
      return nearby.slice(0, 15);
    } else {
      setIsFallbackMode(false);
      return filtered;
    }
  }, [stations, activeTab, userLocation, radius]);

  // 3. Gemini API 分析
  const analyzeMissions = async () => {
    if (processedStations.length === 0) return;
    setIsAnalyzing(true);
    setShowAiModal(true);

    const stationContext = processedStations.map(s => ({
      name: s.sna.replace('YouBike2.0_', ''),
      bikes: s.available_rent_bikes,
      slots: s.available_return_bikes,
      distance: s.dist ? `${s.dist.toFixed(2)}km` : '未知'
    }));

    const prompt = `你是一位專業的 YouBike 調度專家。請分析以下站點並提供策略簡報（最多150字）。
    目前的活動是「友愛接力」，全滿站借車（友愛借車）與全空站還車（友愛還車）皆可獲得5元騎乘券。
    ${isFallbackMode ? '備註：目前無極端站點，請分析附近站點。' : ''}
    請建議優先目標並提供一個專業調度小撇步。
    站點資料: ${JSON.stringify(stationContext)}`;

    const callGemini = async (retryCount = 0) => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: "以繁體中文（台灣）回答。專業且精簡。使用列點。不要使用粗體字。" }] }
            })
          }
        );
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API Error ${response.status}: ${errText}`);
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        if (retryCount < 5) {
          await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
          return callGemini(retryCount + 1);
        }
        throw err;
      }
    };

    try {
      const result = await callGemini();
      setAiInsight(result);
    } catch (err) {
      console.error("Gemini 錯誤:", err);
      setAiInsight(`AI 連線失敗：${err.message}\n\n請確認 Vercel 環境變數 VITE_GEMINI_API_KEY 是否正確設定。`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 位置狀態圖示
  const LocationIcon = () => {
    if (locationStatus === 'loading') return <LocateFixed size={12} className="animate-pulse text-amber-400" />;
    if (locationStatus === 'success') return <LocateFixed size={12} className="text-emerald-400" />;
    if (locationStatus === 'error') return <LocateOff size={12} className="text-rose-400" />;
    if (locationStatus === 'denied') return <LocateOff size={12} className="text-slate-600" />;
    return <MapPin size={12} className="text-indigo-400 animate-pulse" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* 背景裝飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-5 pt-8 pb-24">
        <header className="flex flex-col space-y-2 mb-8">
          <div className="flex justify-between items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2"
            >
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                <Zap size={24} className="text-white fill-current" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  友愛接力助手
                </h1>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">YouBike 2.0 Bonus Tracker</p>
              </div>
            </motion.div>

            <div className="flex space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowRulesModal(true)}
                className="p-3 bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl text-slate-300 hover:text-white transition-colors"
              >
                <Info size={20} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={analyzeMissions}
                disabled={loading || processedStations.length === 0}
                className="p-3 bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 rounded-2xl text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
              >
                <Sparkles size={20} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="p-3 bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </motion.button>
            </div>
          </div>

          {/* 狀態列：更新時間 + 位置狀態 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between pl-1">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
              <span>最後更新: {lastUpdated || '載入中...'} | 北北桃試辦中</span>
            </div>

            {/* 位置狀態按鈕（點擊可重試或開啟詢問） */}
            <button
              onClick={() => {
                if (locationStatus === 'asking' || locationStatus === 'denied') {
                  setLocationStatus('asking');
                } else if (locationStatus !== 'loading') {
                  requestLocation();
                }
              }}
              disabled={locationStatus === 'loading'}
              className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:cursor-not-allowed"
            >
              <LocationIcon />
              <span>
                {locationStatus === 'asking' && <span className="text-indigo-400">開啟定位？</span>}
                {locationStatus === 'loading' && '定位中...'}
                {locationStatus === 'success' && '位置已取得'}
                {locationStatus === 'error' && '點擊重試定位'}
                {locationStatus === 'denied' && '點擊開啟定位'}
                {locationStatus === 'idle' && '取得位置中'}
              </span>
            </button>
          </motion.div>

          {/* 定位錯誤詳細訊息 */}
          <AnimatePresence>
            {locationStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 bg-rose-950/40 border border-rose-800/50 rounded-xl flex items-start space-x-2 text-rose-400"
              >
                <LocateOff size={14} className="mt-0.5 shrink-0" />
                <div className="text-[11px]">
                  <p className="font-bold">定位失敗</p>
                  <p className="text-rose-500">{locationError}。站點將不依距離排序。</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* 標籤切換器 */}
        <div className="relative flex p-1.5 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl mb-4">
          <div 
            className="absolute top-1.5 bottom-1.5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] bg-gradient-to-r rounded-xl shadow-lg"
            style={{
              left: activeTab === 'full' ? '6px' : activeTab === 'empty' ? 'calc(33.333% + 3px)' : 'calc(66.666% + 3px)',
              right: activeTab === 'full' ? 'calc(66.666% + 3px)' : activeTab === 'empty' ? 'calc(33.333% + 3px)' : '6px',
              backgroundImage: activeTab === 'full'
                ? 'linear-gradient(to right, #f97316, #ea580c)'
                : activeTab === 'empty'
                ? 'linear-gradient(to right, #10b981, #059669)'
                : 'linear-gradient(to right, #6366f1, #4f46e5)'
            }}
          />
          <button onClick={() => setActiveTab('full')} className={`relative z-10 flex-1 py-3 px-2 flex flex-col items-center transition-colors duration-300 ${activeTab === 'full' ? 'text-white' : 'text-slate-400'}`}>
            <span className="text-xs font-bold">需借車站</span>
            <span className="text-[11px] opacity-70">滿站借出 $5</span>
          </button>
          <button onClick={() => setActiveTab('empty')} className={`relative z-10 flex-1 py-3 px-2 flex flex-col items-center transition-colors duration-300 ${activeTab === 'empty' ? 'text-white' : 'text-slate-400'}`}>
            <span className="text-xs font-bold">需還車站</span>
            <span className="text-[11px] opacity-70">空站還入 $5</span>
          </button>
          <button onClick={() => setActiveTab('nearby')} className={`relative z-10 flex-1 py-3 px-2 flex flex-col items-center transition-colors duration-300 ${activeTab === 'nearby' ? 'text-white' : 'text-slate-400'}`}>
            <span className="text-xs font-bold">附近站點</span>
            <span className="text-[11px] opacity-70">查看附近</span>
          </button>
        </div>

        {/* 距離範圍選擇器（只有開啟定位才顯示） */}
        <AnimatePresence>
          {userLocation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center space-x-2 mb-4"
            >
              <span className="text-[11px] text-slate-500 whitespace-nowrap">篩選範圍</span>
              <div className="flex flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 space-x-1">
                {[1, 1.5, 2].map(r => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 ${
                      radius === r
                        ? 'bg-slate-600 text-white shadow'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isFallbackMode && !loading && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 px-4 py-2 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center space-x-2 text-slate-400">
              <Compass size={14} className="text-indigo-400" />
              <span className="text-[12px] font-medium">目前無符合條件站點，顯示附近推薦站點</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 站點列表 */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2, 3].map(i => <SkeletonCard key={i} />)
            ) : processedStations.length > 0 ? (
              processedStations.map((s, idx) => (
                <StationCard key={s.sno} station={s} idx={idx} type={isFallbackMode ? 'normal' : activeTab === 'nearby' ? 'normal' : activeTab} />
              ))
            ) : (
              <div className="py-20 text-center text-slate-500">
                <Info size={32} className="mx-auto mb-4 opacity-20" />
                <p>無可用站點資料</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 定位詢問 Modal */}
      <Modal show={locationStatus === 'asking'} onClose={handleDenyLocation} title="開啟位置功能" icon={<LocateFixed />}>
        <div className="text-slate-300 text-sm space-y-4">
          <div className="flex justify-center py-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-full p-6">
              <LocateFixed size={40} className="text-indigo-400" />
            </div>
          </div>
          <p className="text-center text-slate-300 leading-relaxed">
            開啟定位後，站點會依照<span className="text-white font-bold">距離由近到遠</span>排列，更快找到附近的獎勵站點。
          </p>
          <p className="text-center text-[12px] text-slate-500">
            位置資訊僅在您的裝置上計算，不會上傳至伺服器。
          </p>
        </div>
        <div className="flex flex-col space-y-2 mt-6">
          <button
            onClick={requestLocation}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-colors flex items-center justify-center space-x-2"
          >
            <LocateFixed size={16} />
            <span>允許取得位置</span>
          </button>
          <button
            onClick={handleDenyLocation}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium rounded-2xl transition-colors"
          >
            暫時不要
          </button>
        </div>
      </Modal>

      {/* AI Modal */}
      <Modal show={showAiModal} onClose={() => setShowAiModal(false)} title="✨ AI 策略簡報" icon={<Bot />}>
        <div className="min-h-[120px] text-slate-300 text-sm leading-relaxed">
          {isAnalyzing ? (
            <div className="flex flex-col items-center py-8 space-y-4">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 animate-pulse">專家分析中...</p>
            </div>
          ) : (
            <div className="whitespace-pre-line">{aiInsight}</div>
          )}
        </div>
        {!isAnalyzing && (
          <button onClick={() => setShowAiModal(false)} className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-colors">
            收到，立刻出發
          </button>
        )}
      </Modal>

      {/* Rules Modal */}
      <Modal show={showRulesModal} onClose={() => setShowRulesModal(false)} title="友愛接力活動辦法" icon={<ShieldCheck />}>
        <div className="max-h-[65vh] overflow-y-auto pr-2 text-slate-300 text-sm space-y-5 custom-scrollbar">
          <section>
            <h4 className="flex items-center text-indigo-400 text-base font-bold mb-2">
              <Calendar size={18} className="mr-2"/> 活動資訊
            </h4>
            <ul className="space-y-1 pl-1">
              <li>● 期間：2026.1.1 ~ 2026.6.30</li>
              <li>● 地點：台北、新北、桃園 YouBike 2.0 場站</li>
              <li>● 資格：YouBike 會員自動參加，無須登錄</li>
            </ul>
          </section>
          
          <section>
            <h4 className="flex items-center text-indigo-400 text-base font-bold mb-2">
              <Zap size={18} className="mr-2"/> 獎勵說明
            </h4>
            <ul className="space-y-1 pl-1">
              <li>● <b>友愛借車：</b>於「無位可還」站借車，領 $5 騎乘券</li>
              <li>● <b>友愛還車：</b>於「無車可借」站還車，領 $5 騎乘券</li>
              <li>● 限制：10分鐘內最多領取2次獎勵，且需跨站借還</li>
            </ul>
          </section>
          
          <section>
            <h4 className="flex items-center text-indigo-400 text-base font-bold mb-2">
              <Wallet size={18} className="mr-2"/> 騎乘券使用
            </h4>
            <ul className="space-y-1 pl-1">
              <li>● 使用：免設定直接折抵，可單次疊加多張</li>
              <li>● 期限：發送日起 90 天內有效</li>
              <li>● 範圍：限 YouBike 2.0 / 2.0E 使用</li>
            </ul>
          </section>
          
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-[12px] leading-relaxed text-slate-400">
             系統每日 23:59 結算，隔日 07:00 前發送。請至 App「騎乘券管理」查詢。
          </div>

          <a 
            href="https://activity.youbike.com.tw/activity-info/692fb3a84e0237a53005f166" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 w-full py-4 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-2xl transition-all border border-indigo-500/20"
          >
            <span>查看官方完整活動細節</span>
            <ExternalLink size={16} />
          </a>
        </div>
      </Modal>

      {/* 底部懸浮條 */}
      <AnimatePresence>
        {!loading && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-6 left-0 right-0 z-50 px-6 flex justify-center">
            <div onClick={() => setShowRulesModal(true)} className="w-full max-w-xs bg-indigo-600 shadow-2xl shadow-indigo-500/40 rounded-full py-3 px-6 flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
              <div className="flex items-center space-x-3 text-white">
                <div className="bg-white/20 p-1.5 rounded-full"><ArrowRightLeft size={16} /></div>
                <span className="text-sm font-bold tracking-wide">任務成功即領 $5 元</span>
              </div>
              <ChevronRight size={18} className="text-white/60" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 子組件 ---

const Modal = ({ show, onClose, title, icon, children }) => (
  <AnimatePresence>
    {show && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div initial={{ y: 100, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 100, scale: 0.95 }} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                {icon}
                <h2 className="text-lg font-bold">{title}</h2>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={20} /></button>
            </div>
            {children}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const StationCard = forwardRef(({ station, idx, type }, ref) => {
  const isFull = type === 'full';
  const isEmpty = type === 'empty';
  
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: idx * 0.05 }}
      className="group relative"
    >
      <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 rounded-3xl overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFull ? 'bg-orange-500' : isEmpty ? 'bg-emerald-500' : 'bg-indigo-500/30'}`} />

        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1 pr-2">
            <h3 className="text-lg font-bold text-white leading-tight">{station.sna.replace('YouBike2.0_', '')}</h3>
            <div className="flex items-center text-slate-500 text-xs mt-1">
              <MapPin size={12} className="mr-1" />
              <span className="truncate max-w-[180px]">{station.ar}</span>
            </div>
          </div>
          <span className="text-[11px] font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 whitespace-nowrap">
            {station.dist ? `${station.dist.toFixed(2)} km` : '-- km'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold mb-1">可借車輛</span>
            <span className={`text-2xl font-black ${station.available_rent_bikes <= 2 ? 'text-rose-500' : 'text-white'}`}>{station.available_rent_bikes}</span>
          </div>
          <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold mb-1">可還空位</span>
            <span className={`text-2xl font-black ${station.available_return_bikes <= 2 ? 'text-orange-500' : 'text-white'}`}>{station.available_return_bikes}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isFull ? <AlertCircle size={15} className="text-orange-500" /> : isEmpty ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Compass size={15} className="text-slate-500" />}
            <span className={`text-[11px] font-bold ${isFull ? 'text-orange-400' : isEmpty ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isFull ? '獎勵：滿站借出 $5' : isEmpty ? '獎勵：空站還入 $5' : '一般站點'}
            </span>
          </div>
          <button 
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`, '_blank')}
            className="text-xs font-black text-white bg-slate-800 px-4 py-2 rounded-xl hover:bg-slate-700 transition-all flex items-center"
          >
            導航 <Navigation size={12} className="ml-2" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

const SkeletonCard = forwardRef((props, ref) => (
  <div ref={ref} className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl animate-pulse">
    <div className="flex justify-between mb-6">
      <div className="space-y-2"><div className="h-4 w-32 bg-slate-800 rounded"/><div className="h-3 w-48 bg-slate-800 rounded"/></div>
      <div className="h-6 w-12 bg-slate-800 rounded"/>
    </div>
    <div className="grid grid-cols-2 gap-4"><div className="h-14 bg-slate-800/50 rounded-2xl"/><div className="h-14 bg-slate-800/50 rounded-2xl"/></div>
  </div>
));

export default App;