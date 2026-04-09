 import { useEffect, useRef, useState, useCallback } from 'react'
 import { Image } from 'antd'
 
 const MAX_RETRIES = 3
 const BASE_DELAY_MS = 1000
 const OBSERVER_ROOT_MARGIN = '400px'
 const PARSPACK_S3_ORIGIN = 'https://c258565.parspack.net'
 
 /**
  * Strip any Next.js /_next/image proxy wrapper and return the raw S3 URL.
  */
 function toDirectUrl(src) {
   if (!src) return src
   try {
     const u = new URL(src, window.location.origin)
     if (u.pathname.startsWith('/_next/image')) {
       const inner = u.searchParams.get('url')
       if (inner) return inner
     }
   } catch {
     /* keep as-is */
   }
   return src
 }
 
 /**
  * Inject preconnect + dns-prefetch hints once per page life.
  */
 let hintInjected = false
 function injectConnectionHints() {
   if (hintInjected) return
   hintInjected = true
   const head = document.head
   const preconnect = document.createElement('link')
   preconnect.rel = 'preconnect'
   preconnect.href = PARSPACK_S3_ORIGIN
   preconnect.crossOrigin = 'anonymous'
   head.appendChild(preconnect)
   const dnsPrefetch = document.createElement('link')
   dnsPrefetch.rel = 'dns-prefetch'
   dnsPrefetch.href = PARSPACK_S3_ORIGIN
   head.appendChild(dnsPrefetch)
 }
 
 /**
  * Admin grid image with:
  *  1. IntersectionObserver (400px rootMargin) – prefetches before entering viewport.
  *  2. Auto-retry with exponential backoff on error (initial attempt has zero delay).
  *  3. Direct S3 delivery – bypasses any optimization proxy.
  *  4. Ant Design <Image> preview – click thumbnail to enlarge.
  */
 export default function S3AdminImage({ src, width = 50, height = 50, style, alt = '' }) {
   const containerRef = useRef(null)
   const [isVisible, setIsVisible] = useState(false)
   const [imgSrc, setImgSrc] = useState(null)
   const retryCount = useRef(0)
   const [failed, setFailed] = useState(false)
 
   const directSrc = toDirectUrl(src)
 
   useEffect(() => { injectConnectionHints() }, [])
 
   useEffect(() => {
     const node = containerRef.current
     if (!node) return
 
     const observer = new IntersectionObserver(
       ([entry]) => {
         if (entry.isIntersecting) {
           setIsVisible(true)
           observer.disconnect()
         }
       },
       { rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 }
     )
     observer.observe(node)
     return () => observer.disconnect()
   }, [])
 
   useEffect(() => {
     if (isVisible && directSrc) {
       retryCount.current = 0
       setFailed(false)
       setImgSrc(directSrc)
     }
   }, [isVisible, directSrc])
 
   const handleError = useCallback(() => {
     if (retryCount.current < MAX_RETRIES) {
       const attempt = ++retryCount.current
       const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
       setTimeout(() => {
         const sep = directSrc.includes('?') ? '&' : '?'
         setImgSrc(`${directSrc}${sep}retry=${attempt}&t=${Date.now()}`)
       }, delay)
     } else {
       setFailed(true)
     }
   }, [directSrc])
 
   const placeholderStyle = {
     width,
     height,
     borderRadius: 4,
     background: '#f0f0f0',
     display: 'inline-flex',
     alignItems: 'center',
     justifyContent: 'center',
     fontSize: 12,
     color: '#999',
   }
 
   if (!isVisible || !imgSrc) {
     return <div ref={containerRef} style={placeholderStyle} />
   }
 
   if (failed) {
     return <div ref={containerRef} style={placeholderStyle}>✕</div>
   }
 
   return (
     <div ref={containerRef}>
       <Image
         src={imgSrc}
         alt={alt}
         width={width}
         height={height}
         style={{ borderRadius: 4, objectFit: 'cover', ...style }}
        preview={{ src: directSrc }}
        rootClassName="s3-admin-img"
        onError={handleError}
      />
    </div>
   )
 }
