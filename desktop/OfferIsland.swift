import AppKit
import WebKit

class IslandPanel: NSPanel { override var canBecomeKey: Bool { true } }
class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
 var process: Process?; var panel: IslandPanel!; var main: NSWindow!; var status: NSStatusItem!; var timer: Timer?; var attempts=0
 let port=18783
 var base:String { "http://127.0.0.1:\(port)" }
 func applicationDidFinishLaunching(_ notification: Notification) {
  let resources=Bundle.main.resourceURL!
  process=Process();process!.executableURL=resources.appendingPathComponent("node")
  process!.arguments=[resources.appendingPathComponent("app/server/http.mjs").path]
  var env=ProcessInfo.processInfo.environment;env["OFFER_PORT"]="\(port)";env["OFFER_OCR"]=resources.appendingPathComponent("offer-ocr").path;process!.environment=env
  process!.standardOutput=FileHandle.nullDevice;process!.standardError=FileHandle.nullDevice
  do {try process!.run()} catch {showError("无法启动本地数据服务：\(error)");return}
  status=NSStatusBar.system.statusItem(withLength:NSStatusItem.variableLength);status.button?.title="✳"
  let menu=NSMenu();menu.addItem(withTitle:"打开工作台",action:#selector(showMain),keyEquivalent:"o").target=self;menu.addItem(withTitle:"显示 / 隐藏小岛",action:#selector(toggleIsland),keyEquivalent:"i").target=self;menu.addItem(withTitle:"小岛回到屏幕顶部",action:#selector(resetPosition),keyEquivalent:"").target=self;menu.addItem(.separator());menu.addItem(withTitle:"退出 Offer Island",action:#selector(quit),keyEquivalent:"q").target=self;status.menu=menu
  timer=Timer.scheduledTimer(withTimeInterval:0.3,repeats:true){[weak self] _ in self?.waitForServer()}
 }
 func waitForServer(){attempts+=1;if attempts>60{timer?.invalidate();showError("本地服务未能启动。请检查端口 18783 是否被占用。");return};var request=URLRequest(url:URL(string:base+"/api/state")!);request.setValue("web",forHTTPHeaderField:"X-Offer-Client");URLSession.shared.dataTask(with:request){data,response,error in guard error==nil,let data=data,let json=try? JSONSerialization.jsonObject(with:data) as? [String:Any],json["app"] as? String == "offer-island" else{return};DispatchQueue.main.async{if self.panel != nil{return};self.timer?.invalidate();self.setupWindows()}}.resume()}
 func web(_ path:String)->WKWebView{let config=WKWebViewConfiguration();config.userContentController.add(self,name:"native");let view=WKWebView(frame:.zero,configuration:config);view.navigationDelegate=self;view.uiDelegate=self;view.setValue(false,forKey:"drawsBackground");view.load(URLRequest(url:URL(string:base+path)!));return view}
 func setupWindows(){
  main=NSWindow(contentRect:NSRect(x:100,y:100,width:1220,height:820),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false);main.title="Offer Island · 求职小岛";main.contentView=web("/");main.isReleasedWhenClosed=false;main.center()
  panel=IslandPanel(contentRect:NSRect(x:0,y:0,width:460,height:112),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false);panel.level = .floating;panel.backgroundColor = .clear;panel.isOpaque=false;panel.hasShadow=false;panel.isMovableByWindowBackground=true;panel.hidesOnDeactivate=false;panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary];panel.contentView=web("/island.html");resetPosition();panel.orderFrontRegardless();showMain()
 }
 @objc func showMain(){guard main != nil else{return};NSApp.activate(ignoringOtherApps:true);main.makeKeyAndOrderFront(nil)}
 @objc func toggleIsland(){guard panel != nil else{return};if panel.isVisible{panel.orderOut(nil)}else{panel.orderFrontRegardless()}}
 @objc func resetPosition(){guard panel != nil else{return};let screen=NSScreen.main ?? NSScreen.screens[0];let f=screen.visibleFrame;panel.setFrameOrigin(NSPoint(x:f.midX-panel.frame.width/2,y:f.maxY-panel.frame.height-5))}
 @objc func quit(){NSApp.terminate(nil)}
 func showError(_ message:String){let alert=NSAlert();alert.messageText="Offer Island";alert.informativeText=message;alert.runModal();NSApp.terminate(nil)}
 func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){guard let url=message.frameInfo.request.url,url.host=="127.0.0.1",url.port==port,let body=message.body as? [String:Any],let action=body["action"] as? String else{return};switch action{case "backup":if let text=body["text"] as? String, text.utf8.count < 8000000 { let save=NSSavePanel();save.nameFieldStringValue="offer-island-backup.json";save.begin { response in if response == .OK, let url=save.url { do {try text.write(to:url,atomically:true,encoding:.utf8)} catch {self.showError("备份保存失败：\(error)")} } } };case "main":showMain();case "island":panel.orderFrontRegardless();case "hide":panel.orderOut(nil);case "resize":if let h=body["height"] as? Double{let f=panel.frame;panel.setFrame(NSRect(x:f.minX,y:f.maxY-CGFloat(min(400,max(112,h))),width:f.width,height:CGFloat(min(400,max(112,h)))),display:true,animate:true)};default:break}}
 func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let u=action.request.url else{decisionHandler(.cancel);return};if u.host=="127.0.0.1"&&u.port==port{decisionHandler(.allow)}else if ["https","http"].contains(u.scheme ?? ""){NSWorkspace.shared.open(u);decisionHandler(.cancel)}else{decisionHandler(.cancel)}}
 func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void){let panel=NSOpenPanel();panel.allowsMultipleSelection=parameters.allowsMultipleSelection;panel.canChooseDirectories=false;panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }}
 func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? { if let u=action.request.url,["https","http"].contains(u.scheme ?? "") {NSWorkspace.shared.open(u)};return nil }
 func applicationWillTerminate(_ notification:Notification){timer?.invalidate();if process?.isRunning==true{process?.terminate()}}
}
let app=NSApplication.shared;let delegate=AppDelegate();app.delegate=delegate;app.setActivationPolicy(.regular);app.run()
