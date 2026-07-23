export const SAMPLE_DECKS = [
  {
    id: 'futuristic-tech',
    title: 'Quantum & Neural AI Architecture 2026',
    subtitle: 'The Next Paradigm of Autonomous Computing',
    author: 'Dr. Vansh Soni',
    slides: [
      {
        id: 1,
        title: 'Quantum & Neural AI Architecture',
        category: 'KEYNOTE PRESENTATION',
        type: 'title-slide',
        tagline: 'Bridging Silicon, Photonic Chips, & Real-time Web Systems',
        notes: 'Welcome everyone! In today\'s presentation we are exploring real-time web orchestration, quantum neural networks, and mobile-controlled interfaces. Emphasize the live interactive zoom capabilities during this slide.',
        metrics: [
          { label: 'Latency', value: '< 8ms' },
          { label: 'Sync Rate', value: '120 Hz' },
          { label: 'Architecture', value: 'Distributed' }
        ]
      },
      {
        id: 2,
        title: 'Real-Time Web Architecture',
        category: 'SYSTEM DESIGN',
        type: 'diagram-slide',
        notes: 'Here we see the low-latency Socket.io pipeline. Mention how mobile touch input instantly calculates relative bounding box coordinates (0 to 100%) and sends them down to the Host screen with zero jitter.',
        architectureNodes: [
          { name: 'Mobile Controller', desc: 'React + Touch Canvas + iOS Glass UI', color: 'from-blue-500 to-cyan-400' },
          { name: 'Socket.io Server', desc: 'Express + WebSockets State Manager', color: 'from-purple-500 to-indigo-500' },
          { name: 'Host View Screen', desc: 'Next.js + Framer Motion + CSS Transforms', color: 'from-emerald-400 to-teal-500' }
        ],
        codeSnippet: `// Bounding Box Coordinate Normalization
const calcPercentCoords = (rect, canvas) => ({
  x: ((rect.x / canvas.width) * 100).toFixed(2),
  y: ((rect.y / canvas.height) * 100).toFixed(2),
  width: ((rect.width / canvas.width) * 100).toFixed(2),
  height: ((rect.height / canvas.height) * 100).toFixed(2),
});`
      },
      {
        id: 3,
        title: 'Performance & Latency Benchmarks',
        category: 'ANALYTICS & METRICS',
        type: 'metrics-slide',
        notes: 'Highlight the 60fps Framer Motion transitions and hardware-accelerated CSS transforms. Notice how scaling with transform-origin avoids layout recalculation spikes.',
        bars: [
          { name: 'HTTP Polling', latency: '240ms', pct: 90, color: 'bg-rose-500' },
          { name: 'Standard WebSockets', latency: '45ms', pct: 40, color: 'bg-amber-500' },
          { name: 'Socket.io + CSS Matrix', latency: '6ms', pct: 12, color: 'bg-emerald-400' }
        ],
        stats: [
          { number: '99.98%', label: 'State Sync Reliability' },
          { number: '60 FPS', label: 'Zoom & Pan Motion Smoothness' },
          { number: '0 KB', label: 'Frame Buffer Overheads' },
          { number: '1.2M+', label: 'Events Handled / Second' }
        ]
      },
      {
        id: 4,
        title: 'Smart Zoom & Dynamic Filter Engine',
        category: 'FEATURE HIGHLIGHT',
        type: 'feature-slide',
        notes: 'Demonstrate the smart zoom feature live right now! Drag a box on your mobile screen over any card on this slide to zoom in directly. Try activating Spotlight Mode or Dynamic Blur.',
        cards: [
          {
            icon: 'ZoomIn',
            title: 'Precision Bounding Box',
            desc: 'Draw custom target selection on mobile thumbnail to trigger hardware-accelerated pan and scale on host screen.'
          },
          {
            icon: 'Sparkles',
            title: 'Spotlight Focus Mask',
            desc: 'Dimmers out non-essential slide elements with glass blur, highlighting only key talking points.'
          },
          {
            icon: 'Sliders',
            title: 'Real-Time CSS Filters',
            desc: 'Apply live contrast, invert, grayscale, or backdrop blur effects directly from your pocket.'
          },
          {
            icon: 'MousePointer',
            title: 'Laser Pointer Trackpad',
            desc: 'Turn mobile screen into a responsive pointer trackpad with custom particle trailing effects.'
          }
        ]
      },
      {
        id: 5,
        title: 'Apple iOS Glassmorphism Design System',
        category: 'UI / UX PHILOSOPHY',
        type: 'design-slide',
        notes: 'Talk about the UI design aesthetic: frosted glass panels, subtle 1px white borders, backdrop-filter blur(25px), and micro-interaction haptic feedback on every tap.',
        tokens: [
          { label: 'Backdrop Filter', value: 'blur(25px) saturate(180%)' },
          { label: 'Glass Border', value: '1px solid rgba(255, 255, 255, 0.16)' },
          { label: 'Panel Shadow', value: '0 20px 50px rgba(0, 0, 0, 0.5)' },
          { label: 'Micro Interactions', value: 'Scale down (0.94) on touch start' }
        ]
      },
      {
        id: 6,
        title: 'Conclusion & Live QA',
        category: 'SUMMARY',
        type: 'outro-slide',
        notes: 'Wrap up presentation. Trigger confetti from your phone to celebrate a successful keynote! Ask the audience for questions.',
        contact: 'Scan QR code on mobile remote to take control of presentation decks.'
      }
    ]
  },
  {
    id: 'design-systems',
    title: 'Modern UI/UX & Glassmorphism 2026',
    subtitle: 'Crafting Premium Digital Experiences',
    author: 'Design Guild',
    slides: [
      {
        id: 1,
        title: 'The Evolution of Glassmorphism',
        category: 'DESIGN SPECS',
        type: 'title-slide',
        tagline: 'Depth, Vibrancy, & Tactile Material Design',
        notes: 'Introduction to design systems in modern web development.',
        metrics: [
          { label: 'Vibrancy', value: 'High' },
          { label: 'Depth', value: '3D Layered' },
          { label: 'Tactile', value: 'Haptic' }
        ]
      },
      {
        id: 2,
        title: 'Color Palettes & Lighting Gradients',
        category: 'COLOR THEORY',
        type: 'design-slide',
        notes: 'Demonstrate color harmony and contrast ratios.',
        tokens: [
          { label: 'Primary Accent', value: '#007AFF (iOS Electric Blue)' },
          { label: 'Secondary', value: '#BF5AF2 (Neon Purple)' },
          { label: 'Warning', value: '#FF9F0A (Warm Amber)' },
          { label: 'Glass Fill', value: 'rgba(255,255,255,0.08)' }
        ]
      },
      {
        id: 3,
        title: 'Thank You for Attending!',
        category: 'END OF SLIDES',
        type: 'outro-slide',
        notes: 'Final slide notes.',
        contact: 'Created with Presentation Control System'
      }
    ]
  }
];
