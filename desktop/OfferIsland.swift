import AppKit
import WebKit

class IslandPanel: NSPanel {
 override var canBecomeKey: Bool { true }
 override func constrainFrameRect(_ frameRect:NSRect,to screen:NSScreen?)->NSRect { frameRect }
}
class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
 var process: Process?; var panel: IslandPanel!; var status: NSStatusItem!; var statusMenu: NSMenu!; var islandView: WKWebView?; var timer: Timer?; var pointerTimer: Timer?; var pointerEnteredAt: Date?; var pointerLeftAt: Date?; var attempts=0; var isExpanded=false
 var frameTimer: Timer?
 var checkingUpdate=false; var accountModal=false; var displayMenu:NSMenu!
 let port=18783
 var base:String { "http://127.0.0.1:\(port)" }
 func applicationDidFinishLaunching(_ notification: Notification) {
  let resources=Bundle.main.resourceURL!
  process=Process();process!.executableURL=resources.appendingPathComponent("node")
  process!.arguments=[resources.appendingPathComponent("app/server/http.mjs").path]
  var env=ProcessInfo.processInfo.environment;env["OFFER_PORT"]="\(port)";env["OFFER_OCR"]=resources.appendingPathComponent("offer-ocr").path;process!.environment=env
  process!.standardOutput=FileHandle.nullDevice;process!.standardError=FileHandle.nullDevice
  do {try process!.run()} catch {showError("无法启动本地数据服务：\(error)");return}
  status=NSStatusBar.system.statusItem(withLength:NSStatusItem.squareLength)
  if let icon=NSImage(contentsOf:resources.appendingPathComponent("OfferIslandIcon.icns")){icon.size=NSSize(width:18,height:18);status.button?.image=icon;status.button?.imagePosition = .imageOnly}else{status.button?.title="✳"}
  status.button?.toolTip="Offer Island：左键显示 / 隐藏，右键打开菜单";status.button?.target=self;status.button?.action=#selector(statusItemClicked(_:));status.button?.sendAction(on:[.leftMouseUp,.rightMouseUp])
  statusMenu=NSMenu();statusMenu.addItem(withTitle:"打开在线工作台",action:#selector(showOnline),keyEquivalent:"").target=self;statusMenu.addItem(withTitle:"打开本地网页版",action:#selector(showMain),keyEquivalent:"o").target=self;statusMenu.addItem(withTitle:"显示 / 隐藏小岛",action:#selector(toggleIsland),keyEquivalent:"i").target=self;statusMenu.addItem(withTitle:"贴合刘海 / 屏幕顶部",action:#selector(resetPosition),keyEquivalent:"").target=self;statusMenu.addItem(withTitle:"检查更新…",action:#selector(checkUpdates),keyEquivalent:"").target=self;statusMenu.addItem(.separator());statusMenu.addItem(withTitle:"退出 Offer Island",action:#selector(quit),keyEquivalent:"q").target=self
  let displays=NSMenuItem(title:"小岛显示器",action:nil,keyEquivalent:"");displayMenu=NSMenu();displays.submenu=displayMenu;statusMenu.insertItem(displays,at:3);rebuildDisplayMenu()
  NotificationCenter.default.addObserver(self,selector:#selector(screenConfigurationChanged(_:)),name:NSApplication.didChangeScreenParametersNotification,object:nil)
  timer=Timer.scheduledTimer(withTimeInterval:0.3,repeats:true){[weak self] _ in self?.waitForServer()}
 }
 func waitForServer(){attempts+=1;if attempts>60{timer?.invalidate();showError("本地服务未能启动。请检查端口 18783 是否被占用。");return};var request=URLRequest(url:URL(string:base+"/api/state")!);request.setValue("web",forHTTPHeaderField:"X-Offer-Client");URLSession.shared.dataTask(with:request){data,response,error in guard error==nil,let data=data,let json=try? JSONSerialization.jsonObject(with:data) as? [String:Any],json["app"] as? String == "offer-island" else{return};DispatchQueue.main.async{if self.panel != nil{return};self.timer?.invalidate();self.setupWindows()}}.resume()}
 func web(_ path:String)->WKWebView{let config=WKWebViewConfiguration();config.userContentController.add(self,name:"native");let view=WKWebView(frame:.zero,configuration:config);view.navigationDelegate=self;view.uiDelegate=self;view.setValue(false,forKey:"drawsBackground");view.load(URLRequest(url:URL(string:base+path)!));return view}
 func setupWindows(){
  let screen=preferredScreen();let hasNotch=notchGeometry(on:screen) != nil;let initialHeight=collapsedHeight(on:screen);islandView=web("/island.html?notch=\(hasNotch ? "1" : "0")")
  panel=IslandPanel(contentRect:NSRect(x:0,y:0,width:460,height:initialHeight),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false);panel.level=NSWindow.Level(rawValue:NSWindow.Level.statusBar.rawValue+1);panel.backgroundColor = .clear;panel.isOpaque=false;panel.hasShadow=false;panel.isMovableByWindowBackground = !hasNotch;panel.hidesOnDeactivate=false;panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary];panel.contentView=islandView;islandView?.wantsLayer=true;islandView?.layer?.cornerRadius=25;islandView?.layer?.maskedCorners=[.layerMinXMinYCorner,.layerMaxXMinYCorner];islandView?.layer?.masksToBounds=true;resetPosition();panel.orderFrontRegardless()
 }
 @objc func showOnline(){NSWorkspace.shared.open(URL(string:"https://offer-island-milan.netlify.app/")!)}
 @objc func showMain(){NSWorkspace.shared.open(URL(string:base+"/")!)}
 @objc func statusItemClicked(_ sender:NSStatusBarButton){if NSApp.currentEvent?.type == .rightMouseUp{rebuildDisplayMenu();statusMenu.popUp(positioning:nil,at:NSPoint(x:sender.bounds.minX,y:sender.bounds.minY),in:sender)}else{toggleIsland()}}
 @objc func toggleIsland(){guard panel != nil else{return};if panel.isVisible{panel.orderOut(nil)}else{layoutPanel(height:panel.frame.height,animate:false);panel.orderFrontRegardless()}}
 func notchGeometry(on screen:NSScreen)->(width:CGFloat,height:CGFloat)?{guard let left=screen.auxiliaryTopLeftArea,let right=screen.auxiliaryTopRightArea else{return nil};let width=right.minX-left.maxX;let height=max(screen.safeAreaInsets.top,left.height,right.height);guard width>80,height>0 else{return nil};return(width,height)}
 func displayID(_ screen:NSScreen)->Int{(screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.intValue ?? 0}
 func preferredScreen()->NSScreen{if let saved=UserDefaults.standard.object(forKey:"offerDisplayID") as? Int,let screen=NSScreen.screens.first(where:{displayID($0)==saved}){return screen};return NSScreen.screens.first(where:{notchGeometry(on:$0) != nil}) ?? NSScreen.main ?? NSScreen.screens[0]}
 func rebuildDisplayMenu(){
  guard displayMenu != nil else{return};displayMenu.removeAllItems()
  for screen in NSScreen.screens{let item=displayMenu.addItem(withTitle:screen.localizedName,action:#selector(selectDisplay(_:)),keyEquivalent:"");item.target=self;item.tag=displayID(screen);item.state=displayID(preferredScreen())==item.tag ? .on : .off}
  displayMenu.addItem(.separator());displayMenu.addItem(withTitle:"移到鼠标所在显示器",action:#selector(moveToPointerDisplay),keyEquivalent:"").target=self
 }
 func moveIsland(to screen:NSScreen){
  let oldInset=notchGeometry(on:preferredScreen())?.height ?? 0
  UserDefaults.standard.set(displayID(screen),forKey:"offerDisplayID")
  pointerEnteredAt=nil;pointerLeftAt=nil
  if panel != nil{let height=isExpanded ? panel.frame.height-oldInset+(notchGeometry(on:screen)?.height ?? 0) : collapsedHeight(on:screen);layoutPanel(height:height,animate:false);panel.orderFrontRegardless()};rebuildDisplayMenu()
 }
 @objc func selectDisplay(_ sender:NSMenuItem){if let screen=NSScreen.screens.first(where:{displayID($0)==sender.tag}){moveIsland(to:screen)}}
 @objc func moveToPointerDisplay(){if let screen=NSScreen.screens.first(where:{$0.frame.contains(NSEvent.mouseLocation)}){moveIsland(to:screen)}}
 func collapsedHeight(on screen:NSScreen)->CGFloat{notchGeometry(on:screen).map{$0.height+18} ?? 72}
 // Pass the physical safe area to the page; the expanded header starts below it.
 func setNotchMode(_ enabled:Bool){
  let inset=enabled ? (notchGeometry(on:preferredScreen())?.height ?? 0) : 0
  islandView?.evaluateJavaScript("document.documentElement.classList.toggle('notch-mode', \(enabled ? "true" : "false"));document.documentElement.style.setProperty('--notch-height','\(inset)px');document.documentElement.style.setProperty('--collapsed-height','\(collapsedHeight(on:preferredScreen()))px')")
 }
 func layoutPanel(height:CGFloat,animate:Bool){
  guard panel != nil else{return}
  let screen=preferredScreen();let notch=notchGeometry(on:screen)
  let width=isExpanded ? CGFloat(460) : notch.map{max(380,min(500,$0.width+260))} ?? 460
  let top=notch == nil ? screen.visibleFrame.maxY-5 : screen.frame.maxY
  let frame=NSRect(x:screen.frame.midX-width/2,y:top-height,width:width,height:height)
  panel.isMovableByWindowBackground = notch == nil
  setNotchMode(notch != nil)
  // Animate from the current frame so rapid reversals never jump to an old endpoint.
  frameTimer?.invalidate();frameTimer=nil
  guard animate,!NSWorkspace.shared.accessibilityDisplayShouldReduceMotion else{panel.setFrame(frame,display:true);return}
  let start=panel.frame;let began=ProcessInfo.processInfo.systemUptime
  let duration=0.22
  let animation=Timer(timeInterval:1.0/60,repeats:true){[weak self] timer in
   guard let self=self else{timer.invalidate();return}
   let t=min(1,(ProcessInfo.processInfo.systemUptime-began)/duration)
   let eased=CGFloat(1-pow(1-t,3))
   self.panel.setFrame(NSRect(x:start.minX+(frame.minX-start.minX)*eased,y:start.minY+(frame.minY-start.minY)*eased,width:start.width+(frame.width-start.width)*eased,height:start.height+(frame.height-start.height)*eased),display:true)
   if t>=1{timer.invalidate();self.frameTimer=nil}
  }
  frameTimer=animation;RunLoop.main.add(animation,forMode:.common)
 }
 func startPointerTracking(){guard pointerTimer == nil else{return};pointerTimer=Timer(timeInterval:1.0/60,target:self,selector:#selector(trackPointer),userInfo:nil,repeats:true);RunLoop.main.add(pointerTimer!,forMode:.common)}
 func requestExpanded(_ expanded:Bool){guard isExpanded != expanded else{return};isExpanded=expanded;pointerEnteredAt=nil;pointerLeftAt=nil;islandView?.evaluateJavaScript("window.offerIslandSetExpanded?.(\(expanded ? "true" : "false"))")}
 @objc func trackPointer(){if accountModal{pointerEnteredAt=nil;pointerLeftAt=nil;return};guard panel != nil,panel.isVisible else{pointerEnteredAt=nil;pointerLeftAt=nil;return};let inside=panel.frame.insetBy(dx:-4,dy:-4).contains(NSEvent.mouseLocation);let now=Date();if inside{pointerLeftAt=nil;if !isExpanded{if let entered=pointerEnteredAt{if now.timeIntervalSince(entered)>=0.08{requestExpanded(true)}}else{pointerEnteredAt=now}}else{pointerEnteredAt=nil}}else{pointerEnteredAt=nil;if isExpanded{if let left=pointerLeftAt{if now.timeIntervalSince(left)>=0.28{requestExpanded(false)}}else{pointerLeftAt=now}}else{pointerLeftAt=nil}}}
 @objc func resetPosition(){guard panel != nil else{return};let screen=preferredScreen();layoutPanel(height:isExpanded ? panel.frame.height : collapsedHeight(on:screen),animate:true)}
 @objc func screenConfigurationChanged(_ notification:Notification){rebuildDisplayMenu();guard panel != nil else{return};let screen=preferredScreen();layoutPanel(height:isExpanded ? panel.frame.height : collapsedHeight(on:screen),animate:false)}
 @objc func checkUpdates(){
  guard !checkingUpdate else{return};checkingUpdate=true
  var request=URLRequest(url:URL(string:"https://api.github.com/repos/Vonct/offer-island/releases/latest")!);request.timeoutInterval=15;request.setValue("application/vnd.github+json",forHTTPHeaderField:"Accept")
  URLSession.shared.dataTask(with:request){data,response,error in
   DispatchQueue.main.async {
    self.checkingUpdate=false
    let alert=NSAlert();alert.messageText="检查更新"
    let current=Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") as? String ?? "0.3.0"
    guard error==nil,let http=response as? HTTPURLResponse,http.statusCode==200,let data=data,let release=try? JSONSerialization.jsonObject(with:data) as? [String:Any],let tag=release["tag_name"] as? String else {alert.informativeText="暂时无法检查更新，请稍后重试。当前版本："+current;alert.runModal();return}
    let version=tag.hasPrefix("v") ? String(tag.dropFirst()) : tag
    guard version.range(of:"^[0-9]+\\.[0-9]+\\.[0-9]+$",options:.regularExpression) != nil else {alert.informativeText="发行版本格式无法识别，请查看 GitHub Releases。";alert.runModal();return}
    if version.compare(current,options:.numeric) == .orderedDescending {
     alert.messageText="发现新版本 "+tag;alert.informativeText="当前版本："+current+"。打开发布页查看说明并下载。安装前请退出应用，再替换 Applications 中的旧版本；本地数据保留。";alert.addButton(withTitle:"查看更新");alert.addButton(withTitle:"稍后")
     if alert.runModal() == .alertFirstButtonReturn {NSWorkspace.shared.open(URL(string:"https://github.com/Vonct/offer-island/releases/latest")!)}
    }else{alert.informativeText="当前版本 "+current+" 已是最新版本。";alert.runModal()}
   }
  }.resume()
 }
 @objc func quit(){NSApp.terminate(nil)}
 func showError(_ message:String){let alert=NSAlert();alert.messageText="Offer Island";alert.informativeText=message;alert.runModal();NSApp.terminate(nil)}
 func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){guard let url=message.frameInfo.request.url,url.host=="127.0.0.1",url.port==port,let body=message.body as? [String:Any],let action=body["action"] as? String else{return};switch action{case "backup":if let text=body["text"] as? String, text.utf8.count < 8000000 { let save=NSSavePanel();save.nameFieldStringValue="offer-island-backup.json";save.begin { response in if response == .OK, let url=save.url { do {try text.write(to:url,atomically:true,encoding:.utf8)} catch {self.showError("备份保存失败：\(error)")} } } };case "accountModal":accountModal=body["open"] as? Bool ?? false;case "main":showMain();case "online":showOnline();case "island":panel.orderFrontRegardless();case "hide":panel.orderOut(nil);case "resize":if let h=body["height"] as? Double{isExpanded=body["expanded"] as? Bool ?? (h>112);let screen=preferredScreen();let inset=notchGeometry(on:screen)?.height ?? 0;let height=isExpanded ? CGFloat(min(400,h))+inset : collapsedHeight(on:screen);layoutPanel(height:height,animate:true)};default:break}}
 // A page reload resets JavaScript state, including the account dialog. Reset
 // the native state at the same boundary instead of retaining its modal lock.
 func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!){
  guard webView === islandView else{return}
  pointerTimer?.invalidate();pointerTimer=nil
  accountModal=false;isExpanded=false;pointerEnteredAt=nil;pointerLeftAt=nil
  if panel != nil{layoutPanel(height:collapsedHeight(on:preferredScreen()),animate:false)}
 }
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
  guard webView === islandView else{return}
  setNotchMode(notchGeometry(on:preferredScreen()) != nil);startPointerTracking()
 }
 func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let u=action.request.url else{decisionHandler(.cancel);return};if u.host=="127.0.0.1"&&u.port==port{decisionHandler(.allow)}else if ["https","http"].contains(u.scheme ?? ""){NSWorkspace.shared.open(u);decisionHandler(.cancel)}else{decisionHandler(.cancel)}}
 func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void){let panel=NSOpenPanel();panel.allowsMultipleSelection=parameters.allowsMultipleSelection;panel.canChooseDirectories=false;panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }}
 func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? { if let u=action.request.url,["https","http"].contains(u.scheme ?? "") {NSWorkspace.shared.open(u)};return nil }
 func applicationWillTerminate(_ notification:Notification){timer?.invalidate();pointerTimer?.invalidate();frameTimer?.invalidate();if process?.isRunning==true{process?.terminate()}}
}
let app=NSApplication.shared;let delegate=AppDelegate();app.delegate=delegate;app.setActivationPolicy(.accessory);app.run()
