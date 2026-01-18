import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoredBook, Translation } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Bundle the worker for offline usage
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Handle potential default export mismatch in some bundlers
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#4ade80' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Red', value: '#f87171' },
  { name: 'Purple', value: '#c084fc' },
];

const ERASER_CURSOR = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNCcgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSd3aGl0ZScgc3Ryb2tlPSdibGFjaycgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxwYXRoIGQ9J203IDIxLTQuMy00LjNjLTEtMS0xLTIuNSAwLTMuNGw5LjYtOS42YzEtMSAyLjUtMSAzLjQgMGw1LjYgNS42YzEgMSAxIDIuNSAwIDMuNEwxMyAyMScvPjxwYXRoIGQ9J00yMiAyMUg3Jy8+PHBhdGggZD0nbTUgMTEgOSA5Jy8+PC9zdmc+") 6 18, auto`;
const PEN_CURSOR = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNCcgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSd3aGl0ZScgc3Ryb2tlPSdibGFjaycgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxwYXRoIGQ9J20xOC41IDIuNSAzIDMgLTExIDExIC0zIDAgMCAtMyAxMSAtMTF6Jy8+PC9zdmc+") 0 24, auto`;

interface BookReaderProps {
  book: StoredBook;
  onBack: () => void;
  onUpdateBook: (book: StoredBook) => void;
  t: Translation;
}

const BookReader: React.FC<BookReaderProps> = ({ book, onBack, onUpdateBook, t }) => {
  const [showControls, setShowControls] = useState(true);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  // PDF Specific State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPage, setPdfPage] = useState<any>(null);
  const [scale, setScale] = useState(1.5);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isPen, setIsPen] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<{x: number, y: number} | null>(null);
  const currentDrawingRef = useRef<{x: number, y: number}[]>([]);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [pinchStartDist, setPinchStartDist] = useState<number | null>(null);
  const [startScale, setStartScale] = useState<number>(1.5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  const [highlightColor, setHighlightColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('penko-reader-settings');
      return saved ? JSON.parse(saved).highlightColor || '#facc15' : '#facc15';
    } catch { return '#facc15'; }
  });
  
  // Initialize settings from local storage to ensure persistence works correctly
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('penko-reader-settings');
      return saved ? JSON.parse(saved).fontSize || 18 : 18;
    } catch { return 18; }
  });

  const [lineHeight, setLineHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('penko-reader-settings');
      return saved ? JSON.parse(saved).lineHeight || 1.6 : 1.6;
    } catch { return 1.6; }
  });

  const [readerTheme, setReaderTheme] = useState<'light' | 'sepia' | 'dark' | 'black'>(() => {
    try {
      const saved = localStorage.getItem('penko-reader-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.readerTheme) return parsed.readerTheme;
      }
    } catch {}
    
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  
  const [toc, setToc] = useState<{id: string, label: string, index: number}[]>([]);
  const [processedContent, setProcessedContent] = useState(book.content);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  // Initialize PDF if needed
  useEffect(() => {
    if (book.fileType === 'pdf') {
      setError(null);
      const loadingTask = pdfjs.getDocument(book.content);
      loadingTask.promise.then((pdf) => {
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(book.progress > 0 ? Math.floor(book.progress) : 1);
      }).catch((err: any) => {
        console.error("PDF Load Error:", err);
        setError(`Failed to load PDF: ${err.message || 'Unknown error'}`);
      });
    }
  }, [book.id, book.fileType, book.content]);

  // Save settings to local storage
  useEffect(() => {
    localStorage.setItem('penko-reader-settings', JSON.stringify({
      fontSize,
      lineHeight,
      readerTheme,
      highlightColor
    }));
  }, [fontSize, lineHeight, readerTheme, highlightColor]);

  // Parse content for TOC and inject IDs
  useEffect(() => {
    if (book.fileType !== 'pdf' && /<[a-z][\s\S]*>/i.test(book.content)) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(book.content, 'text/html');
            
            // Find headers for TOC
            const headers = Array.from(doc.querySelectorAll('h1, h2, .chapter'));
            const newToc: {id: string, label: string, index: number}[] = [];
            
            headers.forEach((header, index) => {
                if (!header.id) header.id = `chapter-${index}`;
                const label = header.textContent?.trim().substring(0, 60) || `Chapter ${index + 1}`;
                if (label) newToc.push({ id: header.id, label, index });
            });

            if (newToc.length > 0) {
                setToc(newToc);
                setProcessedContent(doc.body.innerHTML);
            }
        } catch (e) {
            console.error("Error parsing TOC", e);
        }
    }
  }, [book.content, book.fileType]);

  // Calculate pages and restore position
  useEffect(() => {
    if (book.fileType === 'pdf') return; // Skip for PDF
    const updateLayout = () => {
      if (contentRef.current) {
        const { scrollWidth, clientWidth } = contentRef.current;
        const stride = clientWidth;
        const pages = Math.ceil(scrollWidth / stride);
        setTotalPages(pages);

        // Restore position based on progress
        if (book.totalTokens > 0 && book.progress > 0) {
           const percentage = Math.min(1, Math.max(0, book.progress / book.totalTokens));
           const targetPage = Math.max(1, Math.ceil(percentage * pages));
           setCurrentPage(targetPage);
           contentRef.current.scrollTo({ left: (targetPage - 1) * stride, behavior: 'auto' });
        }
      }
    };

    // Wait for content to render
    const timer = setTimeout(updateLayout, 100);
    window.addEventListener('resize', updateLayout);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateLayout);
    }
  }, [processedContent, fontSize, lineHeight, book.fileType]);

  // Fetch PDF Page when currentPage changes
  useEffect(() => {
    if (pdfDoc) {
      pdfDoc.getPage(currentPage).then((page: any) => {
        setPdfPage(page);
      });
    }
  }, [pdfDoc, currentPage]);

  // Render PDF Page
  useEffect(() => {
    if (book.fileType === 'pdf' && pdfPage && canvasRef.current) {
      let isCancelled = false;
      const page = pdfPage;

        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Cancel previous render if it exists
        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch (e) {
                // Ignore cancellation errors
            }
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        // Render page
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        renderTask.promise.then(() => {
           renderTaskRef.current = null;
           if (isCancelled) return;

           // Draw highlights after render
           if (book.highlights) {
             const pageHighlights = book.highlights.filter(h => h.page === currentPage);
             
             // Use multiply blend mode for realistic highlighter effect
             context!.globalCompositeOperation = 'multiply';
             context!.globalAlpha = 0.75;
             
             pageHighlights.forEach(h => {
               context!.fillStyle = h.color || '#facc15';
               context!.fillRect(h.x * viewport.width, h.y * viewport.height, h.width * viewport.width, h.height * viewport.height);
             });
             
             // Reset composite operation
             context!.globalCompositeOperation = 'source-over';
             context!.globalAlpha = 1.0;
           }

           // Draw drawings after render
           if (book.drawings) {
             const pageDrawings = book.drawings.filter(d => d.page === currentPage);
             context!.lineCap = 'round';
             context!.lineJoin = 'round';
             pageDrawings.forEach(d => {
               context!.beginPath();
               context!.strokeStyle = d.color;
               context!.lineWidth = d.strokeWidth * viewport.scale;
               if (d.points.length > 0) {
                 context!.moveTo(d.points[0].x * viewport.width, d.points[0].y * viewport.height);
                 for (let i = 1; i < d.points.length; i++) {
                   context!.lineTo(d.points[i].x * viewport.width, d.points[i].y * viewport.height);
                 }
               }
               context!.stroke();
             });
           }
        }).catch((err: any) => {
            // Ignore cancellation errors
            if (err?.name !== 'RenderingCancelledException') {
                console.error("Render error:", err);
            }
        });

      return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
            try {
                renderTaskRef.current.cancel();
            } catch (e) {
                // Ignore
            }
        }
      };
    }
  }, [pdfPage, scale, book.highlights, book.drawings, book.fileType]);

  const handlePdfPointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (isErasing) {
        if (book.highlights) {
             // Find intersecting highlight (iterate backwards to find top-most)
             let indexToRemove = -1;
             for (let i = book.highlights.length - 1; i >= 0; i--) {
                 const h = book.highlights[i];
                 if (h.page === currentPage && 
                     x >= h.x && x <= h.x + h.width && 
                     y >= h.y && y <= h.y + h.height) {
                     indexToRemove = i;
                     break;
                 }
             }

             if (indexToRemove !== -1) {
                 const newHighlights = [...book.highlights];
                 newHighlights.splice(indexToRemove, 1);
                 onUpdateBook({ ...book, highlights: newHighlights });
             }

             // Check drawings
             if (book.drawings) {
                 // Simple proximity check for eraser
                 const drawingIndex = book.drawings.findIndex(d => 
                     d.page === currentPage && 
                     d.points.some(p => Math.hypot(p.x - x, p.y - y) < 0.02) // 2% tolerance
                 );
                 
                 if (drawingIndex !== -1) {
                     const newDrawings = [...book.drawings];
                     newDrawings.splice(drawingIndex, 1);
                     onUpdateBook({ ...book, drawings: newDrawings });
                 }
             }
        }
        return;
    }

    if (isPen) {
        currentDrawingRef.current = [{x, y}];
        const ctx = canvasRef.current.getContext('2d');
        const drawX = e.clientX - rect.left;
        const drawY = e.clientY - rect.top;
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(drawX, drawY);
            ctx.strokeStyle = highlightColor;
            ctx.lineWidth = 2 * scale;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
        return;
    }

    if (isHighlighting) {
        setSelectionStart({ x, y });
        setSelectionCurrent({ x, y });
    }
  };

  const handlePdfPointerUp = (e: React.PointerEvent) => {
    if (isPen && currentDrawingRef.current.length > 0) {
        const newDrawing = {
            page: currentPage,
            color: highlightColor,
            strokeWidth: 2,
            points: currentDrawingRef.current
        };
        onUpdateBook({ ...book, drawings: [...(book.drawings || []), newDrawing] });
        currentDrawingRef.current = [];
        return;
    }

    if (isErasing || !isHighlighting || !selectionStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / rect.width;
    const endY = (e.clientY - rect.top) / rect.height;
    
    const newHighlight = {
      page: currentPage,
      x: Math.min(selectionStart.x, endX),
      y: Math.min(selectionStart.y, endY),
      width: Math.abs(endX - selectionStart.x),
      height: Math.abs(endY - selectionStart.y),
      color: highlightColor
    };

    const updatedHighlights = [...(book.highlights || []), newHighlight];
    onUpdateBook({ ...book, highlights: updatedHighlights });
    setSelectionStart(null);
    setSelectionCurrent(null);
  };

  const handlePdfPointerMove = (e: React.PointerEvent) => {
    if (isPen && currentDrawingRef.current.length > 0 && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const rect = canvasRef.current.getBoundingClientRect();
        const drawX = e.clientX - rect.left;
        const drawY = e.clientY - rect.top;
        if (ctx) {
            ctx.lineTo(drawX, drawY);
            ctx.stroke();
            const rect = canvasRef.current.getBoundingClientRect();
            currentDrawingRef.current.push({
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height
            });
        }
        return;
    }

    if (!isHighlighting || !selectionStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setSelectionCurrent({ x, y });
  };

  const handleScroll = () => {
    if (book.fileType === 'pdf') return;
    if (contentRef.current) {
      const { scrollLeft, clientWidth } = contentRef.current;
      const stride = clientWidth;
      const page = Math.round(scrollLeft / stride) + 1;
      
      if (page !== currentPage) {
        setCurrentPage(page);
        
        // Update progress
        const percentage = (page - 1) / (totalPages - 1 || 1);
        const newProgress = Math.floor(percentage * book.totalTokens);
        
        if (timeoutRef.current) clearTimeout(timeoutRef.current as any);
        timeoutRef.current = setTimeout(() => onUpdateBook({ ...book, progress: newProgress, lastRead: Date.now() }), 500);
      }

      // Update chapter based on visible element
      // Note: In column layout, finding the visible element is tricky, 
      // so we rely on the page mapping if possible, or just keep the last known chapter.
    }
  };

  const turnPage = (direction: 'next' | 'prev') => {
    if (book.fileType === 'pdf') {
      const newPage = direction === 'next' ? Math.min(totalPages, currentPage + 1) : Math.max(1, currentPage - 1);
      setCurrentPage(newPage);
      onUpdateBook({ ...book, progress: newPage, lastRead: Date.now() }); // For PDF, progress = page number
      return;
    }

    if (contentRef.current) {
      const { clientWidth, scrollLeft } = contentRef.current;
      const stride = clientWidth;
      const currentPageIdx = Math.round(scrollLeft / stride);
      const nextPageIdx = direction === 'next' ? currentPageIdx + 1 : currentPageIdx - 1;
      
      contentRef.current.scrollTo({ left: nextPageIdx * stride, behavior: 'smooth' });
    }
  };

  const scrollToId = (id: string) => {
      const element = document.getElementById(id);
      if (element && contentRef.current) {
          // For column layout, we need to calculate the horizontal offset
          // This is complex because offsetLeft is relative to the document in some browsers for columns
          // A simpler approach for now is to just scroll the element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
          
          setShowToc(false);
          setShowControls(false);
      }
  };

  const skipChapter = (direction: 'prev' | 'next') => {
      const newIndex = direction === 'next' ? currentChapterIndex + 1 : currentChapterIndex - 1;
      if (newIndex >= 0 && newIndex < toc.length) {
          scrollToId(toc[newIndex].id);
          setCurrentChapterIndex(newIndex);
      }
  };

  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch started
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchStartDist(dist);
      setStartScale(scale);
      return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist) {
      // Pinching
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchStartDist;
      const newScale = Math.min(5.0, Math.max(0.5, startScale * factor));
      setScale(newScale);
      return;
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    setPinchStartDist(null);
    if (!touchStart || !touchEnd) return;
    
    // Don't swipe if drawing tools are active
    if (isPen || isHighlighting || isErasing) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) turnPage('next');
    if (isRightSwipe) turnPage('prev');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        turnPage('prev');
      } else if (e.key === 'ArrowRight') {
        turnPage('next');
      } else if (e.key === 'Escape') {
        if (showToc) setShowToc(false);
        else if (showSettings) setShowSettings(false);
        else onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToc, showSettings, onBack]);

  const getThemeClasses = () => {
      switch (readerTheme) {
          case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636]';
          case 'dark': return 'bg-slate-900 text-slate-300';
          case 'black': return 'bg-black text-gray-400';
          default: return 'bg-white text-slate-900';
      }
  };

  const getControlClasses = () => {
      switch (readerTheme) {
          case 'sepia': return 'bg-[#f4ecd8]/95 border-[#e3dcc5] text-[#5b4636]';
          case 'dark': return 'bg-slate-900/95 border-slate-800 text-slate-300';
          case 'black': return 'bg-black/90 border-gray-800 text-gray-400';
          default: return 'bg-white/95 border-slate-200 text-slate-900';
      }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col h-screen w-screen overflow-hidden ${getThemeClasses()} transition-colors duration-300`}>
      
      {/* Top Menu */}
      <div 
        className={`absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 border-b backdrop-blur z-30 transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'} ${getControlClasses()}`}
      >
        <div className="flex items-center gap-2">
            <button onClick={() => setShowToc(true)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t.chapters}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
            <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t.back}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
            </button>
        </div>

        <h1 className="font-bold truncate max-w-[50%] text-sm sm:text-base">{book.title}</h1>

        <div className="flex items-center gap-2 relative">
            <button 
                onClick={() => setShowSettings(!showSettings)} 
                className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${showSettings ? 'bg-black/10 dark:bg-white/10' : ''}`}
                title="Appearance Settings"
            >
                <span className="font-serif font-bold text-lg">Aa</span>
            </button>
            
            {book.fileType === 'pdf' && (
              <>
              <button 
                onClick={() => {
                    setIsHighlighting(!isHighlighting);
                    setIsPen(false);
                    setIsErasing(false);
                }} 
                className={`p-2 rounded-full transition-colors ${isHighlighting ? 'bg-yellow-200 text-yellow-800 ring-2 ring-yellow-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                title="Highlight Tool"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              </button>
              <button 
                onClick={() => {
                    setIsPen(!isPen);
                    setIsHighlighting(false);
                    setIsErasing(false);
                }} 
                className={`p-2 rounded-full transition-colors ${isPen ? 'bg-blue-200 text-blue-800 ring-2 ring-blue-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                title="Pen Tool"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
              </button>
              <button 
                onClick={() => {
                    setIsErasing(!isErasing);
                    setIsPen(false);
                    setIsHighlighting(false);
                }} 
                className={`p-2 rounded-full transition-colors ${isErasing ? 'bg-red-200 text-red-800 ring-2 ring-red-400' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                title="Eraser Tool"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                </svg>
              </button>
              </>
            )}

            {/* Settings Popover */}
            {showSettings && (
                <div className={`absolute top-full right-0 mt-2 w-64 p-4 rounded-xl shadow-xl border z-40 ${getControlClasses()}`}>
                    <div className="space-y-4">
                        {/* Theme */}
                        <div className="flex justify-between gap-2">
                            {['light', 'sepia', 'dark', 'black'].map((theme) => (
                                <button
                                    key={theme}
                                    onClick={() => setReaderTheme(theme as any)}
                                    className={`flex-1 h-8 rounded-full border ${readerTheme === theme ? 'ring-2 ring-cyan-500' : 'border-transparent'} shadow-sm`}
                                    style={{
                                        backgroundColor: theme === 'light' ? '#fff' : theme === 'sepia' ? '#f4ecd8' : theme === 'dark' ? '#0f172a' : '#000',
                                        color: theme === 'light' ? '#000' : theme === 'sepia' ? '#5b4636' : '#fff'
                                    }}
                                >
                                    A
                                </button>
                            ))}
                        </div>
                        
                        {book.fileType === 'pdf' ? (
                          <div className="space-y-1">
                            {/* Zoom Control */}
                            <div className="flex justify-between text-xs opacity-70">
                                <span>Zoom</span>
                                <span>{Math.round(scale * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="5.0" step="0.1" value={scale}
                                onChange={(e) => setScale(Number(e.target.value))}
                                className="w-full h-1 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                            />
                            
                            {/* Highlight Color Picker */}
                            <div className="pt-2 border-t border-black/10 dark:border-white/10 mt-2">
                                <div className="text-xs opacity-70 mb-2">Highlight Color</div>
                                <div className="flex justify-between gap-1">
                                    {HIGHLIGHT_COLORS.map((c) => (
                                        <button
                                            key={c.name}
                                            onClick={() => setHighlightColor(c.value)}
                                            className={`w-6 h-6 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110 ${highlightColor === c.value ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-800' : ''}`}
                                            style={{ backgroundColor: c.value }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>
                          </div>
                        ) : (
                        <>
                        {/* Font Size */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs opacity-70">
                                <span>{t.size}</span>
                                <span>{fontSize}px</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs">A</span>
                                <input 
                                    type="range" min="12" max="32" step="1" value={fontSize}
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                    className="flex-1 h-1 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                />
                                <span className="text-lg">A</span>
                            </div>
                        </div>

                        {/* Line Height */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs opacity-70">
                                <span>Spacing</span>
                                <span>{lineHeight}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                                <input 
                                    type="range" min="1.0" max="2.5" step="0.1" value={lineHeight}
                                    onChange={(e) => setLineHeight(Number(e.target.value))}
                                    className="flex-1 h-1 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                            </div>
                        </div>
                        </>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* TOC Sidebar */}
      <div 
        className={`absolute top-0 left-0 bottom-0 w-72 z-40 shadow-2xl transform transition-transform duration-300 ${showToc ? 'translate-x-0' : '-translate-x-full'} ${getControlClasses()} border-r`}
      >
          <div className="h-14 flex items-center justify-between px-4 border-b border-black/5 dark:border-white/5">
              <h2 className="font-bold uppercase text-xs tracking-wider opacity-70">{t.chapters || "Table of Contents"}</h2>
              <button onClick={() => setShowToc(false)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-3.5rem)] p-2">
              {toc.length > 0 ? (
                  toc.map((item, i) => (
                      <button 
                        key={i} 
                        onClick={() => scrollToId(item.id)}
                        className={`block w-full text-left text-sm py-3 px-3 rounded-lg transition-colors truncate ${currentChapterIndex === i ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                      >
                          {item.label}
                      </button>
                  ))
              ) : (
                  <div className="p-4 text-center opacity-50 text-sm">No chapters found</div>
              )}
          </div>
      </div>
      
      {/* Overlay for TOC */}
      {showToc && (
          <div className="absolute inset-0 bg-black/50 z-30 backdrop-blur-sm" onClick={() => setShowToc(false)} />
      )}

      {/* PDF Content Area */}
      {book.fileType === 'pdf' ? (
        <div 
            className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 relative touch-pan-y" 
            onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
           <div className="min-h-full min-w-full flex items-center justify-center p-8">
             {error ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 p-8 text-center">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 text-red-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
               <p className="font-bold mb-2">Could not load PDF</p>
               <p className="text-sm opacity-80">{error}</p>
             </div>
           ) : (
             <div className="relative shadow-lg select-none" style={{ width: 'fit-content', height: 'fit-content' }}>
               <canvas 
                 ref={canvasRef} 
                 className={`block bg-white ${isHighlighting ? 'cursor-crosshair' : ''}`}
                 style={{ cursor: isErasing ? ERASER_CURSOR : isPen ? PEN_CURSOR : undefined, touchAction: (isPen || isHighlighting || isErasing) ? 'none' : 'auto' }}
                 onPointerDown={handlePdfPointerDown}
                 onPointerUp={handlePdfPointerUp}
                 onPointerMove={handlePdfPointerMove}
               />
               {isHighlighting && selectionStart && selectionCurrent && (
                  <div 
                    className="absolute pointer-events-none mix-blend-multiply"
                    style={{
                      left: `${Math.min(selectionStart.x, selectionCurrent.x) * 100}%`,
                      top: `${Math.min(selectionStart.y, selectionCurrent.y) * 100}%`,
                      width: `${Math.abs(selectionCurrent.x - selectionStart.x) * 100}%`,
                      height: `${Math.abs(selectionCurrent.y - selectionStart.y) * 100}%`,
                      backgroundColor: highlightColor,
                      opacity: 0.75
                    }}
                  />
               )}
             </div>
           )}
           </div>
        </div>
      ) : (
      <>
      {/* Content Area (Paginated) */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-x-auto overflow-y-hidden scroll-smooth"
        style={{
            columnWidth: '100vw',
            columnGap: '40px',
            columnFill: 'auto',
            height: '100%',
            padding: '60px 20px', // Top/Bottom padding for bars
        }}
        onClick={() => { setShowControls(!showControls); setShowSettings(false); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onScroll={handleScroll}
      >
        <div 
          className="h-full font-serif transition-all duration-200 selection:bg-cyan-200 dark:selection:bg-cyan-900"
          style={{ 
              fontSize: `${fontSize}px`, 
              lineHeight: lineHeight,
              textAlign: 'justify'
          }}
        >
          {/<[a-z][\s\S]*>/i.test(processedContent) ? (
             <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          ) : (
             <div className="whitespace-pre-wrap">{processedContent}</div>
          )}
        </div>
      </div>
      </>
      )}

      {/* Bottom Bar */}
      <div 
        className={`absolute bottom-0 left-0 right-0 h-16 flex items-center justify-between px-4 border-t backdrop-blur z-30 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'} ${getControlClasses()}`}
      >
        <button 
            onClick={() => turnPage('prev')}
            disabled={currentPage <= 1}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
        </button>

        <div className="flex flex-col items-center gap-1 flex-1 px-4">
            <div className="flex items-center gap-1 text-xs font-medium opacity-50 uppercase tracking-wider">
                <span>Page</span>
                <input 
                    type="number" 
                    min={1} 
                    max={totalPages || 1} 
                    value={currentPage}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= (totalPages || 1)) {
                            setCurrentPage(val);
                            if (book.fileType === 'pdf') {
                                onUpdateBook({ ...book, progress: val, lastRead: Date.now() });
                            } else if (contentRef.current) {
                                // For EPUB/Text, we need to scroll
                                const stride = contentRef.current.clientWidth;
                                contentRef.current.scrollTo({ left: (val - 1) * stride, behavior: 'smooth' });
                            }
                        }
                    }}
                    className="w-10 text-center bg-transparent border-b border-slate-400 dark:border-slate-600 focus:border-cyan-500 focus:outline-none p-0 mx-1"
                />
                <span>of {totalPages || 1}</span>
            </div>
            <div className="w-full max-w-xs h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-cyan-500 transition-all duration-300" 
                    style={{ width: `${Math.min(100, (currentPage / (totalPages || 1)) * 100)}%` }} 
                />
            </div>
        </div>

        <button 
            onClick={() => turnPage('next')}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
        </button>
      </div>
    </div>
  );
};

export default BookReader;