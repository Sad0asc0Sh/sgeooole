import Script from "next/script";

/**
 * Third-Party Scripts Component
 * 
 * این کامپوننت تمام اسکریپت‌های third-party را مدیریت می‌کند
 * و از استراتژی‌های بهینه برای لود کردن آن‌ها استفاده می‌کند
 */
export default function ThirdPartyScripts() {
    return (
        <>
            {/* Google Analytics */}
            {process.env.NEXT_PUBLIC_GA_ID && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                        strategy="afterInteractive"
                    />
                    <Script id="google-analytics" strategy="afterInteractive">
                        {`
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                                page_path: window.location.pathname,
                            });
                        `}
                    </Script>
                </>
            )}

            {/* Google Tag Manager */}
            {process.env.NEXT_PUBLIC_GTM_ID && (
                <Script
                    id="google-tag-manager"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                            })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');
                        `,
                    }}
                />
            )}

            {/* Facebook Pixel */}
            {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
                <Script
                    id="facebook-pixel"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                            !function(f,b,e,v,n,t,s)
                            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                            n.queue=[];t=b.createElement(e);t.async=!0;
                            t.src=v;s=b.getElementsByTagName(e)[0];
                            s.parentNode.insertBefore(t,s)}(window, document,'script',
                            'https://connect.facebook.net/en_US/fbevents.js');
                            fbq('init', '${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');
                            fbq('track', 'PageView');
                        `,
                    }}
                />
            )}

            {/* Hotjar */}
            {process.env.NEXT_PUBLIC_HOTJAR_ID && (
                <Script
                    id="hotjar"
                    strategy="lazyOnload"
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function(h,o,t,j,a,r){
                                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                                h._hjSettings={hjid:${process.env.NEXT_PUBLIC_HOTJAR_ID},hjsv:6};
                                a=o.getElementsByTagName('head')[0];
                                r=o.createElement('script');r.async=1;
                                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                                a.appendChild(r);
                            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
                        `,
                    }}
                />
            )}

            {/* Crisp Chat */}
            {process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID && (
                <Script
                    id="crisp-chat"
                    strategy="lazyOnload"
                    dangerouslySetInnerHTML={{
                        __html: `
                            window.$crisp=[];
                            window.CRISP_WEBSITE_ID="${process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID}";
                            (function(){
                                d=document;
                                s=d.createElement("script");
                                s.src="https://client.crisp.chat/l.js";
                                s.async=1;
                                d.getElementsByTagName("head")[0].appendChild(s);
                            })();
                        `,
                    }}
                />
            )}

            {/* Tawk.to Chat */}
            {process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID && process.env.NEXT_PUBLIC_TAWK_WIDGET_ID && (
                <Script
                    id="tawk-chat"
                    strategy="lazyOnload"
                    dangerouslySetInnerHTML={{
                        __html: `
                            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
                            (function(){
                                var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
                                s1.async=true;
                                s1.src='https://embed.tawk.to/${process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID}/${process.env.NEXT_PUBLIC_TAWK_WIDGET_ID}';
                                s1.charset='UTF-8';
                                s1.setAttribute('crossorigin','*');
                                s0.parentNode.insertBefore(s1,s0);
                            })();
                        `,
                    }}
                />
            )}

            {/* Custom Analytics or Scripts */}
            {process.env.NEXT_PUBLIC_CUSTOM_SCRIPT_URL && (
                <Script
                    src={process.env.NEXT_PUBLIC_CUSTOM_SCRIPT_URL}
                    strategy="lazyOnload"
                />
            )}
        </>
    );
}
