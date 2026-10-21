package ir.spygame.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

/**
 * پوسته اندرویدی بازی «جاسوس | SPY».
 * تمام منطق و ظاهر بازی در پوشه assets (HTML/CSS/JS) است و بدون اینترنت اجرا می‌شود.
 * این کلاس فقط وب‌ویو را نمایش می‌دهد و چند قابلیت سیستمی را در اختیار بازی می‌گذارد:
 *  - جلوگیری از اسکرین‌شات و پیش‌نمایش برنامه‌های اخیر در صفحه‌های محرمانه
 *  - روشن ماندن صفحه حین بازی
 *  - لرزش پایان زمان
 *  - مدیریت دکمه بازگشت
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        webView.setBackgroundColor(Color.parseColor("#07060D"))
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        setContentView(webView)

        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true          // برای ذخیره تنظیمات و رکوردها (localStorage)
        s.allowFileAccess = true
        s.allowContentAccess = false
        s.mediaPlaybackRequiresUserGesture = false
        s.setSupportZoom(false)
        s.builtInZoomControls = false
        s.displayZoomControls = false

        // فقط محتوای داخلی برنامه نمایش داده می‌شود؛ هر ناوبری دیگری مسدود است.
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = true
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(NativeBridge(), "SpyNative")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(window.__spyBack ? window.__spyBack() : false)"
                ) { handled ->
                    if (handled != "true") {
                        finish()
                    }
                }
            }
        })

        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("SpyNative")
        webView.destroy()
        super.onDestroy()
    }

    /** پل ارتباطی بین جاوااسکریپت بازی و قابلیت‌های سیستم اندروید. */
    inner class NativeBridge {

        @JavascriptInterface
        fun setSecure(on: Boolean) {
            runOnUiThread {
                if (on) {
                    this@MainActivity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                } else {
                    this@MainActivity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
            }
        }

        @JavascriptInterface
        fun keepScreenOn(on: Boolean) {
            runOnUiThread {
                if (on) {
                    this@MainActivity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    this@MainActivity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }

        @JavascriptInterface
        fun vibrate(ms: Int) {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
            if (!vibrator.hasVibrator()) return
            val duration = ms.coerceIn(10, 2000).toLong()
            vibrator.vibrate(
                VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
            )
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finish() }
        }
    }
}
