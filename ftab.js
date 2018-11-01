/*******************************************************************************
	FTab(Floating Tabs)
	Copyright (c) 2006-2009 uuware.com. All rights reserved.
	Developed by project@uuware.com, Visit http://www.uuware.com/ for details.

	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the
	"Software"), to deal in the Software without restriction, including
	without limitation the rights to use, copy, modify, merge, publish,
	distribute, sublicense, and/or sell copies of the Software, and to
	permit persons to whom the Software is furnished to do so, subject to
	the following conditions:

	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
	LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
	OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*******************************************************************************/
/*******************************************************************************
FTab(Floating TabPage)
function FTab(tabID, left, top, width, height, style, showPageIndex)
can used like:(notice no 'new' as var o = new FTab(...), but no errors even use 'new'.)
  var o = FTab(tabID,10,10,200,160,'title:1;minmax:1;close:1;move:0;status:1;resize:1;scroll:1;tab:1;tabrect:1;expandable:0;cookie:1;toolbar:0;',0);
  o.show(pageIndex);
also can like this:
  FTab(tabID,10,10,200,160,'').show(pageIndex);
20131214:added style 'create:1;' for not exist tabID then create it and set one tabpage
when create FTab,need this params(left, top, and others),but while next time only need tabID to refer to FTab.
for styles,default of all params is 1.if no title(title:0),then no close and minmax buttons even set them as 1,
and also no moving.and also if no status(status:0),then no resize.

user's event:
FTabs.OnPageShow = function(ftab,index)
{
  window.status='FTabs.OnPageShow, ftab id:'+ftab.id + ', index:' + index + '.';
}
FTabs.OnActing = function(ftab)
{
  window.status='FTabs.OnActing, ftab id:'+ftab.id + '.';
}
FTabs.OnDeActing = function(ftab)
{
  window.status='FTabs.OnDeActing, ftab id:'+ftab.id + '.';
}
FTabs.OnMinMax = function(ftab, isMin)
{
  window.status='FTabs.OnMinMax, ftab id:'+ftab.id + ', isMin:' + isMin;
}
FTabs.OnHide = function(ftab)
{
  window.status='FTabs.OnHide, ftab id:'+ftab.id + '.';
}
*******************************************************************************/

var FTAB_UA = navigator.userAgent.toLowerCase(); 
var FTab_MSIE = (FTAB_UA.indexOf('msie') >= 0 ? true : false); //whether is IE.
var FTab_TOUCH = (FTAB_UA.indexOf('iphone;') >= 0 || FTAB_UA.indexOf('ipad;') >= 0);
var FTab_JS = 'ftab.js'; //only used for getting path of this js.
var FTab_PATH = ''; //path of style and also image.
var FTab_M_Lst = []; //for saving top win
//get relative style&image path(same to js' path)
var scripts = document.getElementsByTagName('script');
for(var i = 0; i < scripts.length; i++){
  var src = scripts[i].getAttribute('src');
  //through name of 'ftab.js'
  if(src && (src == FTab_JS || (src.length > FTab_JS.length && (src.substring(src.length - FTab_JS.length - 1) == '/' + FTab_JS
    || src.substring(src.length - FTab_JS.length - 1) == '\\' + FTab_JS)))){
    FTab_PATH = src.substring(0, src.length - FTab_JS.length);
    break;
  }
}
var FTab_ZIndex = 1001;
var FTab_ActWin = null; //oMain for moving window
FTabs = new Object(); //for user's event

function FTab_GetCookie(name)
{
  var start = document.cookie.indexOf(name+"=");
  var len = start+name.length+1;
  if((!start) && (name != document.cookie.substring(0,name.length))) return null;
  if(start == -1) return null;
  var end = document.cookie.indexOf(";",len);
  if(end == -1) end = document.cookie.length;
  return unescape(document.cookie.substring(len,end));
}
function FTab_SetCookie(name,value,expires,path,domain,secure)
{
  if(expires) expires = expires * 60*60*24*1000;
  else expires = 100 * 60*60*24*1000;
  var today = new Date();
  var expires_date = new Date( today.getTime() + (expires) );
  var cookieString = name + "=" +escape(value) +
     ( (expires) ? ";expires=" + expires_date.toGMTString() : "") +
     ( (path) ? ";path=" + path : "") +
     ( (domain) ? ";domain=" + domain : "") +
     ( (secure) ? ";secure" : "");
  document.cookie = cookieString;
}
function FTab_SaveConfig(name,showPageIndex,left,top,width,height,nState,nZIndex)
{
  var sitems = null;
  var sbuf = FTab_GetCookie(name + '.');
  if(sbuf){
    sitems = sbuf.split('_');
  }
  if(!sitems || sitems.length != 8) {sitems = new Array();}
  if(typeof(showPageIndex)=='number') sitems[0] = ''+showPageIndex;
  if(typeof(left)=='number') sitems[1] = ''+left;
  if(typeof(top)=='number') sitems[2] = ''+top;
  if(width) sitems[3] = width;
  if(height) sitems[4] = height;
  if(typeof(nState)=='number') sitems[5] = ''+nState;
  if(nZIndex) sitems[6] = nZIndex;
  sbuf = '';
  for(var i=0;i<7;i++) sbuf = sbuf + (sitems[i] ? sitems[i] : '') + '_'
  FTab_SetCookie(name + '.', sbuf, 100);
}

//used for resizing
var FTab_g_mtimer = null;
function FTab_MMoveTimer()
{
  if(FTab_g_mtimer) FTab_g_mtimer = clearTimeout(FTab_g_mtimer);
  if(!FTab_ActWin || !FTab_ActWin.M_Moving) return false;
  if(FTab_ActWin.M_StatusCnt >= 0 && FTab_ActWin.M_StatusCnt < 20){
    FTab_ActWin.M_StatusCnt++;
    FTab_g_mtimer = setTimeout('FTab_MMoveTimer()', 10);
  }
}
function FTab_GetWins()
{
  var r = new Array();
  var tabs = document.getElementsByTagName("table");
  for(var i = 0; i < tabs.length; i++){
    var t = tabs[i].id;
    if(t && t.length > 8 && t.substring(t.length-8) == '_m_table'){
      var m_ID = t.substring(0, t.length-8);
      var oMain = document.getElementById(m_ID);
      if(oMain && oMain.objSelf && oMain.m_ID && oMain.objCreated == 1){
        r.push(oMain);
      }
    }
  }
  return r;
}
var FTab_g_stimer = null;
function FTab_MScroll(e)
{
}
function FTab_MScroll2(e, isCenter)
{
  var isCont = false;
  var r = FTab_GetWins();
  for(t in r){
    if(!r[t]) continue;
    var oMain = r[t];
    if(oMain.objSelf.isKeepCenter() && oMain.style.position == 'absolute'){
    	oMain.objSelf.moveCenter();
    }
    else if(isCenter && oMain.objSelf.isFixed() && oMain.style.position == 'absolute'){
      var l = 0 + oMain.M_FixX + ( document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft );
      var t = 0 + oMain.M_FixY + ( document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop );
      var nl = oMain.style.left.replace('px','')/1;
      var nt = oMain.style.top.replace('px','')/1;
      if(nt!=t || nl!=l) {
        isCont = true;
        oMain.style.left = nl-parseInt((nl-l)/2) + 'px';
        oMain.style.top = nt-parseInt((nt-t)/2) + 'px';
        oTmp2 = document.getElementById(oMain.m_ID+'_i_ifrm');
        if(oTmp2){
          var oTmp = document.getElementById(oMain.m_ID + '_m_table');
          oTmp2.style.width = (oTmp.clientWidth+3) + 'px';
          oTmp2.style.height = (oTmp.clientHeight+3) + 'px';
        }
      }
    }
  }
  if(isCont) FTab_g_stimer = setTimeout('FTab_MScroll2()', 100);
}
function FTab_MResize(e)
{
  if (FTab_g_stimer) FTab_g_stimer = clearTimeout(FTab_g_stimer);
  FTab_g_stimer = setTimeout('FTab_MScroll2()', 200);

  var d = document;
  m = d.getElementById('SFTab_popmask');
  if(m){
    var w = d.body.parentNode.clientWidth;
    var h = d.body.parentNode.clientHeight;
    var c = document.body;
    if(d.compatMode && d.compatMode.toLowerCase() == 'css1compat') c = d.documentElement;
    if(w < c.scrollWidth){
      w = c.scrollWidth;
    }
    if(h < c.scrollHeight){
      h = c.scrollHeight;
    }
    m.style.width = w +'px';
    m.style.height = h  +'px';
  }

  FTab_MScroll2(e, true);
}
//if onscroll is used,then need call this at there
if(typeof('addEvent') == 'function') {
  addEvent('scroll', FTab_MResize);
  addEvent('resize', FTab_MResize);
}
else {
  (window.addEventListener) ? window.addEventListener( "scroll", FTab_MResize, false ) : window.attachEvent("onscroll", FTab_MResize);
  (window.addEventListener) ? window.addEventListener( "resize", FTab_MResize, false ) : window.attachEvent("onresize", FTab_MResize);
}

//////////////////////////////////////////////////////////////////////////////
//FTab(Floating TabPage)
function FTab(tabID, left, top, width, height, style, showPageIndex)
{
  if(typeof(style) != 'string') style = '';
  while(style.indexOf(' ') >= 0) { style = style.replace(/ /g, ''); }
  var oMain = document.getElementById(tabID);
  if(!oMain && style.indexOf('create:1')>=0) {
    var el = document.createElement('div');
    el.id = tabID;
    el.innerHTML = '<div title="title"></div>';
    var ob = document.getElementsByTagName("body").item(0);
    if(ob) { ob.appendChild(el); }
    oMain = document.getElementById(tabID);
  }

  if(oMain == null || typeof(oMain) != 'object' || !oMain.hasChildNodes()) return null;
  if(typeof(oMain.objSelf) == 'object' && oMain.m_ID == tabID) return oMain.objSelf;
  if(oMain.m_ID != tabID || oMain.objCreated != 1)
  {
    oMain.m_ID = tabID;
    oMain.objCreated = 1;
    oMain.objSelf = new FTab(tabID, left, top, width, height, style, showPageIndex);
    return oMain.objSelf;
  }

  var isInitOK = false;
  var tabPages = new Array();
  var tabTitles = new Array();
  var selectedIndex = 0;
  var m_ID = tabID;
  var oBody = null;
  this.id = tabID;
  this.m_ID = tabID;
  this.oMain = oMain;
  oMain.tabPages = tabPages;

  //init,not show until show()
  init();

  //private function
  function isValid()
  {
    return (oMain != null && isInitOK);
  }

  //private function
  function init()
  {
    //style = 'title:1;minmax:1;close:1;move:0;status:1;resize:1;scroll:1;tab:1;tabrect:1;expandable:0;cookie:1;toolbar:0;';
    var noScroll = (style.indexOf('scroll:0')>=0);
    var noStatus = (style.indexOf('status:0')>=0);
    var noResize = (noStatus || style.indexOf('resize:0')>=0);
    var noTitle = (style.indexOf('title:0')>=0);
    var noFixed = (noTitle || style.indexOf('fixed:0')>=0);
    var noMinMax = (noTitle || style.indexOf('minmax:0')>=0);
    var noClose = (style.indexOf('close:0')>=0);
    var noTab = (style.indexOf('tab:0')>=0);
    var expandAble = (style.indexOf('expandable:1')>=0);
    var noTabRect = (noTitle && !noTab && style.indexOf('tabrect:0')>=0);
    var modal = (style.indexOf('modal:1')>=0);
    var center = (style.indexOf('center:1')>=0);
    var keepcenter = (center && style.indexOf('keepcenter:1')>=0);
    var noCookie = (center || style.indexOf('cookie:0')>=0);
    var noMove = ((noTitle && !keepcenter) || style.indexOf('move:0')>=0);
    var toolbar = (style.indexOf('toolbar:1')>=0);
    if(expandAble){
      noTitle = false;
      noResize = true;
      noMinMax = true;
      noClose = true;
      noMove = true;
      noStatus = true;
      noFixed = true;
      modal = false;
      center = false;
      keepcenter = false;
    }

	oMain.m_kcenter = keepcenter;

    //get all Page
    var oPage = oMain.firstChild;
    while(oPage){
      if(oPage.nodeName=='DIV' && typeof(oPage.title)=='string'){
        tabPages.push(oPage);
      }
      oPage = oPage.nextSibling;
    }
    if(tabPages.length <= 0) return false;

    if(expandAble) oMain.className = 'ftab_main_parent ftab_main_ext';
    else oMain.className = 'ftab_main_parent';
    oMain.style.display = 'none';
    oMain.noMinMax = noMinMax;
    oMain.noTitle = noTitle;
    oMain.noClose = noClose;
    oMain.noResize = noResize;
    oMain.modal = modal;
    oMain.noFixed = noFixed;
    oMain.expandAble = expandAble;
    var sbuf = '<table id="' + m_ID + '_m_table" ';
    var cls = 'ftab_main';
    if(noTabRect) cls += ' ftab_main_norect'
    sbuf += 'class="'+cls+'" width="100%" height="100%" CELLPADDING="0" CELLSPACING="0">';
    //add Title
    if(!noTitle){
      if(typeof(oMain.title) != 'string') oMain.title = '';
      sbuf += '<tr><td class="ftab_title"><div style="border:0;padding:0px;margin:0px;vertical-align:top;">';
      sbuf += '<span id="' + m_ID + '_t_title">';
      if(expandAble) sbuf += getIcon(m_ID + '_t_pm', 9, 8);
      sbuf += '<button class="ftab_button ftab_titleh">'+oMain.title + '</button></span><input type="button" class="ftab_button ftab_titleh"/>';
      if(!noFixed) sbuf += getIcon(m_ID + '_t_fix', 3, 8);
      if(!noMinMax) sbuf += getIcon(m_ID + '_t_min', 0, 8);
      if(!noClose) sbuf += getIcon(m_ID + '_t_close', 2, 8);
      sbuf += '</div></td></tr>';
    }
    else if(!noClose) {
      sbuf += '<div style="position:absolute;top:-20px;right:-20px;width:20px;height:20px;">'+getIcon(m_ID+'_t_close', 7, 5, '', 20, 20)+'</div>';
    }
    //add Toolbar
    if(toolbar){
      sbuf += '<tr><td class="ftab_tbar" id="' + m_ID + '_tbar" style="height:0px;"></td></tr>';
    }
    //add Tab
    if(!noTab){
      if(!noTabRect) sbuf += '<tr><td class="ftab_tab">';
      else sbuf += '<tr><td class="ftab_tab ftab_tab_norect">';
      for(var i = 0; i < tabPages.length; i++){
        sbuf += '<span title='+tabPages[i].title+'><span class="ftab_deact" id="' + m_ID + '_p_title' + i + '">' + tabPages[i].title;
        sbuf += '</span><span class="ftab_deactr" id="' + m_ID + '_p_r' + i + '">  </span></span>';
      }
      sbuf += '<input type="button" class="ftab_button ftab_tabh';
      if(!noTabRect) sbuf += '"/>';
      else sbuf += ' ftab_tab_norecth"/>';
      sbuf += '</div></td></tr>';
    }
    //add Body
    if(!noTabRect) sbuf += '<tr><td class="ftab_body"';
    else sbuf += '<tr><td class="ftab_body ftab_body_norect"';
    sbuf += ' style="height:99%;vertical-align:top;" id="' + m_ID + '_m_body"></td></tr>';
    //add StatusBar
    if(!noStatus && !noTabRect){
      sbuf += '<tr><td class="ftab_status">';
      sbuf += '<table CELLPADDING="0" CELLSPACING="0" BORDER="0" style="font-size:9px;width:100%;"><tr><td nowrap style="width:99%;padding:0px;margin:0px;vertical-align:top;"><span id="' + m_ID + '_s_title"></span>';
      if(!noResize) sbuf += '</td><td style="width:1px;vertical-align:bottom;">' + getIcon(m_ID + '_s_move', 7, 8, 'cursor:nw-resize;height:12px;vertical-align:bottom;');
      sbuf += '</td></tr></table></td></tr>';
    }
    sbuf += '</table>';

    var div = document.createElement('DIV');
    oMain.insertBefore(div, oMain.firstChild);
    div.style.cssText = 'width:100%;height:100%;margin:0px;padding:0px;';
    div.innerHTML = sbuf;

    oBody = document.getElementById(m_ID + '_m_body');
    var oTable = document.getElementById(m_ID + '_m_table');
    //add Body Contents
    for(var i = 0; i < tabPages.length; i++)
    {
      tabPages[i].className = 'ftab_bodysub';
      oBody.appendChild(tabPages[i]);
      sbuf = '' + tabPages[i].style.cssText;
      if(noScroll) sbuf = 'overflow-x:hidden;overflow-y:hidden;' + sbuf;
      else sbuf = 'overflow-x:auto;overflow-y:auto;' + sbuf;
      if(navigator.userAgent.indexOf('Opera')>=0 && !noScroll) sbuf = 'overflow:scroll;' + sbuf;
      tabPages[i].style.cssText = sbuf; //'margin:0px;padding:0px;' + 
    }

    if(!noTitle){
      var oTmp = document.getElementById(m_ID + '_t_title').parentNode;
      oTmp.onselectstart = cancelEvent;
      oTmp.ondragstart = cancelEvent;
      oTmp.onmousedown = doMDown;
      if(FTab_TOUCH) {
        oTmp.ontouchstart = doMDown;
      }
      if(expandAble){
        oTmp.onclick = function(){switchMinMax();return false;};
        oTmp.style.cursor = 'pointer';
      }
      if(!noMove){
        oTmp.style.cursor = 'move';
        oMain.style.position = 'absolute';
      }
      if(!noFixed){
        var oTmp = document.getElementById(m_ID + '_t_fix');
        oTmp.onclick = function(){switchFixed();return false;};
      }
      if(!noMinMax){
        var oTmp = document.getElementById(m_ID + '_t_min');
        oTmp.onclick = function(){switchMinMax();return false;};
      }
    }
    else if(keepcenter) {
      oMain.style.position = 'absolute';
    }
    if(!noClose){
      var oTmp = document.getElementById(m_ID + '_t_close');
      if(oTmp) oTmp.onclick = function(){hide();return false;};
    }

    if(!noTab){
      for(var i = 0; i < tabPages.length; i++)
      {
        var oTmp = document.getElementById(m_ID + '_p_title' + i);
        oTmp.onselectstart = cancelEvent;
        oTmp.ondragstart = cancelEvent;
        oTmp.onmousedown = cancelEvent;
        oTmp.save_index = i;
        oTmp.onclick = function(){show(this.save_index);return false;};

        var oTmp = document.getElementById(m_ID + '_p_r' + i);
        oTmp.onselectstart = cancelEvent;
        oTmp.ondragstart = cancelEvent;
        oTmp.onmousedown = cancelEvent;
        oTmp.save_index = i;
        oTmp.onclick = function(){show(this.save_index);return false;};
      }
    }
    oTable.onmousedown = doBringToFront;
    oBody.onmousedown = doBringToFront;
    oMain.onmousedown = doBringToFront;

    var oTmp = document.getElementById(m_ID + '_s_title');
    if(oTmp){
      oTmp.parentNode.onselectstart = cancelEvent;
      oTmp.parentNode.ondragstart = cancelEvent;
      oTmp.parentNode.onmousedown = cancelEvent;
      var oTmp = document.getElementById(m_ID + '_s_move');
      if(oTmp) {
        oTmp.onmousedown = doMDownStatus;
        if(FTab_TOUCH) {
          oTmp.ontouchstart = doMDownStatus;
        }
      }
    }

    var nState = 1;
    if(style.indexOf('initmin:0')>=0) nState = 0;
    var nZIndex = 0;
    if(!noCookie){
      var sbuf = FTab_GetCookie(m_ID + '.');
      if(sbuf){
        var sitems = sbuf.split('_');
        if(sitems.length==8){
          if(sitems[0]!='') showPageIndex = sitems[0]/1;
          if(!expandAble && sitems[1]!='') left = sitems[1]/1;
          if(!expandAble && sitems[2]!='') top = sitems[2]/1;
          if(!expandAble && sitems[3]!='') width = sitems[3]/1;
          if(!expandAble && sitems[4]!='') height = sitems[4]/1;
          if(sitems[5]!='') nState = sitems[5]/1;
          if(sitems[6]!='') nZIndex = sitems[6]/1;
        }
      }
    }

    if(typeof(showPageIndex) != 'number' || showPageIndex >= tabPages.length || showPageIndex < 0) showPageIndex = 0;
    isInitOK = true;
    show(showPageIndex);
    if(nZIndex > 0){
      oMain.style.zIndex = nZIndex;
      if(FTab_ZIndex < nZIndex) FTab_ZIndex = nZIndex;
      FTab_SaveConfig(m_ID, false,false,false,false,false,false,nZIndex);
    }

    //if not noMove,must set left&top
    if(!noMove){
      if(typeof(left) != 'number') left = oMain.offsetLeft;
      if(typeof(top) != 'number') top = oMain.offsetTop;
    }
    if(typeof(left) == 'number') oMain.style.left = left + 'px';
    else if(typeof(left) == 'string') oMain.style.left = left;
    if(typeof(top) == 'number') oMain.style.top = top + 'px';
    else if(typeof(top) == 'string') oMain.style.top = top;

    //if not noResize,must set width&height
    if(!noResize){
      if(typeof(width) != 'number') width = oTable.clientWidth;
      if(typeof(height) != 'number') height = oTable.clientHeight;
    }
    if(typeof(width) == 'number'){
      minWidth(oMain);
      if(width < oMain.M_MinWidth) width = oMain.M_MinWidth;
      oMain.style.width = width + 'px';
      for(var i = 0; i < tabPages.length; i++)
        tabPages[i].style.width = width + 'px';
    }
    else if(typeof(width) == 'string') oMain.style.width = width;
    if(typeof(height) == 'number'){
      oMain.M_OffsetH = (oMain.clientHeight - tabPages[selectedIndex].clientHeight);
      height -= oMain.M_OffsetH;
      if(height < 0) height = 0;
      height += oMain.M_OffsetH;
      oMain.style.height = height + 'px';
      oMain.M_OffsetH = height;
      var oTmp = document.getElementById(m_ID + '_t_title');
      if(oTmp) height -= oTmp.parentNode.clientHeight - 1;
      oTmp = document.getElementById(m_ID + '_s_title');
      if(oTmp) height -= oTmp.parentNode.clientHeight - 1;
      oTmp = document.getElementById(m_ID + '_p_title0');
      if(oTmp) height -= oTmp.parentNode.parentNode.clientHeight - 1;
      oMain.M_OffsetH -= height;

      for(var i = 0; i < tabPages.length; i++)
        tabPages[i].style.height = height + 'px';
      oBody.style.height = height + 'px';
    }
    else if(typeof(height) == 'string') oMain.style.height = height;

    if(FTab_MSIE && !noMove && !window.XMLHttpRequest){
      try {
        //need try, for not work while >ie9
        var iframe = document.createElement('<IFRAME id="' + m_ID + '_i_ifrm" scrolling="no" frameborder="0" src="about:blank" style="position:absolute;padding:0px;top:-1px;left:-1px;z-index:3;">');
        oMain.appendChild(iframe);
        oTable.parentNode.style.cssText = 'position:absolute;height:100%;width:100%;margin:0px;padding:0px;top:0px;left:0px;z-index:10;';
        iframe.style.width = (oTable.clientWidth+3) + 'px';
        iframe.style.height = (oTable.clientHeight+3) + 'px';
      }
      catch(e) {
      }
    }
    if(!noMove && center){
      moveCenter();
    }
    if(oTable.clientWidth > width) {
      width = width - (oTable.clientWidth - width);
      oMain.style.width = width + 'px';
      for(var i = 0; i < tabPages.length; i++)
        tabPages[i].style.width = width + 'px';
    }
    if(nState == 0) switchMinMax();

    return this;
  }
  this.moveCenter = moveCenter;
  function moveCenter() {
      if(oMain.style.display == 'none') return;
      var oTable = document.getElementById(oMain.m_ID + '_m_table');
      var d = document.body;
      if(document.compatMode && document.compatMode.toLowerCase() == 'css1compat') d = document.documentElement;
      var ll = parseInt((window.innerWidth - oTable.clientWidth)/2);
      var tt = parseInt((window.innerHeight - oTable.clientHeight)/2);
      if(ll < 0) ll = 0;
      if(tt < 0) tt = 0;
      if(oMain.noTitle && !oMain.noClose && tt < 22) tt = 22;
      oMain.style.left = (d.scrollLeft + ll) + 'px';
      oMain.style.top = (d.scrollTop + tt) + 'px';
  }

  //private function
  function getIcon(id, x, y, sty, ww, hh) {
    var s = '<input id="' + id + '" type="button" class="ftab_button" style="width:'+(ww||14)+'px;height:'+(hh||11)+'px;'
          + 'overflow:hidden;zoom:1;cursor:pointer;border:0;margin: 0 !important;';
    if(sty) s += sty;
    s     +='background-color: transparent !important;background-image:url('+FTab_PATH+'buttons_morden.gif);'
          + 'background-position:'+((x+1) * -18)+'px '+((y+1) * -18)+'px;">';
    return s;
  }

  //private function(obj = oMain)
  function minWidth(obj)
  {
    //TODO
    return 0;
    var oTmp = document.getElementById(obj.m_ID + '_t_title');
    if(oTmp){
      obj.M_MinWidth = oTmp.clientWidth + 15;
      if(!obj.noMinMax) obj.M_MinWidth += 20;
      if(!oMain.noTitle && !obj.noClose) obj.M_MinWidth += 20;
      if(!obj.noFixed) obj.M_MinWidth += 20;
    }
    else obj.M_MinWidth = 32;

    var minw2 = 0;
    for(var i = 0; i < obj.tabPages.length; i++){
      var oTmp = document.getElementById(obj.m_ID + '_p_title' + i);
      if(oTmp) minw2 += (oTmp.offsetWidth + 1);
      var oTmp = document.getElementById(obj.m_ID + '_p_r' + i);
      if(oTmp) minw2 += (oTmp.offsetWidth + 1);
    }
    if(obj.M_MinWidth < minw2) obj.M_MinWidth = minw2;

    oTmp = document.getElementById(obj.m_ID + '_s_title');
    if(oTmp){
      minw2 = oTmp.clientWidth + 15;
      if(!obj.noResize) minw2 += 20;
      if(obj.M_MinWidth < minw2) obj.M_MinWidth = minw2;
    }
    if(isValid() && oMain.style.display != 'none' && !isMin()){
      var oTmp2 = document.getElementById(m_ID + '_i_ifrm');
      if(oTmp2){
        var oTmp = document.getElementById(m_ID + '_m_table');
        oTmp2.style.width = (oTmp.clientWidth+3) + 'px';
        oTmp2.style.height = (oTmp.clientHeight+3) + 'px';
      }
    }
    return obj.M_MinWidth;
  }

  this.doBringToFront = doBringToFront;
  function doBringToFront(e, esrc)
  {
    //for e maybe null,so cannot:e=e||event;
    if(!esrc){
      if(window.all) e=event;
      if(e) esrc = e.target || e.srcElement;
      if(!esrc) return true;
    }
    while(esrc && esrc != document){
      if(esrc.m_ID && esrc.objCreated == 1){
        if(FTab_ActWin == esrc && esrc.style.zIndex >= FTab_ZIndex) return true;
        if(FTab_ActWin && FTab_ActWin.m_ID){
          var oTmp = document.getElementById(FTab_ActWin.m_ID + '_t_title');
          if(oTmp) oTmp.parentNode.className = 'ftab_title';
          if(FTabs && typeof(FTabs.OnDeActing) == 'function'){
            try{
              FTabs.OnDeActing(FTab_ActWin.objSelf);
            }catch(e){}
          }
        }
        FTab_ActWin = esrc;
        var oTmp = document.getElementById(esrc.m_ID + '_t_title');
        if(oTmp) oTmp.parentNode.className = 'ftab_title ftab_title_act';
        if(esrc.style && esrc.style.zIndex < FTab_ZIndex){
          //count parent
          var nparent = 1;
          var esrcparent = esrc;
          while(esrcparent && esrcparent != document){
            esrcparent = esrcparent.parentNode;
            if(esrcparent.m_ID && esrcparent.objCreated == 1 && esrcparent.style && esrcparent.style.position == 'absolute'){
              nparent++;
            }
          }
          FTab_ZIndex += nparent;
          if(FTab_ZIndex < 1001) FTab_ZIndex = 1001 + nparent;
          esrc.style.zIndex = FTab_ZIndex;
          FTab_SaveConfig(esrc.m_ID, false,false,false,false,false,false,esrc.style.zIndex);
          //set parent zIndex
          nparent = FTab_ZIndex;
          while(nparent > 1 && esrc && esrc != document){
            esrc = esrc.parentNode;
            if(esrc.m_ID && esrc.objCreated == 1 && esrc.style && esrc.style.position == 'absolute'){
              nparent -= 1;
              esrc.style.zIndex = nparent;
              FTab_SaveConfig(esrc.m_ID, false,false,false,false,false,false,esrc.style.zIndex);
            }
          }
        }
        break;
      }
      esrc = esrc.parentNode;
    }

    if(FTab_ActWin && FTabs && typeof(FTabs.OnActing) == 'function'){
      try{
        FTabs.OnActing(FTab_ActWin.objSelf);
      }catch(e){}
    }
    return true;
  }

  this.doMMask = doMMask;
  function doMMask(e)
  {
    m = document.getElementById(oMain.m_ID + '_mmask');
    if(!m){
      m = document.createElement('div');
      m.id = oMain.m_ID + '_mmask';
      oMain.appendChild(m);
      m.style.cssText = 'display:none;position:absolute;z-index:99990;top: 20px;left: 0px;width: 100%;height: 100%;';
    }
    m.style.display = '';
  }

  this.doMDownStatus = doMDownStatus;
  function doMDownStatus(e)
  {
    e = e||event;
    doBringToFront(e);
    if((e.button && e.button != 1) || (e.which && e.which != 1)) return false;
    FTab_ActWin = oMain;
    FTab_ActWin.M_StatusCnt = 20;
    FTab_ActWin.oBody = document.getElementById(oMain.m_ID + '_m_body');

    FTab_ActWin.M_PosY = oMain.style.height.replace('px','')/1;
    FTab_ActWin.M_PosX = oMain.style.width.replace('px','')/1;
    FTab_ActWin.M_Moving = true;
    FTab_ActWin.M_MovingType = 2;
    FTab_ActWin.M_MinWidth = -1;
    if(FTab_TOUCH) {
      FTab_ActWin.M_InitX = e.changedTouches[0].pageX;
      FTab_ActWin.M_InitY = e.changedTouches[0].pageY;

      FTab_ActWin.M_DocMMove = document.ontouchmove;
      FTab_ActWin.M_DocMStop = document.ontouchend;
      document.ontouchmove = doMMove;
      document.ontouchend = doMUp;
    }
    else {
      FTab_ActWin.M_InitX = e.clientX;
      FTab_ActWin.M_InitY = e.clientY;

      FTab_ActWin.M_DocMMove = document.onmousemove;
      FTab_ActWin.M_DocMStop = document.onmouseup;
      document.onmousemove = doMMove;
      document.onmouseup = doMUp;
    }
    doMMask(e);
    return false;
  }

  this.doMDown = doMDown;
  function doMDown(e)
  {
    e = e||event;
    doBringToFront(e);
    var oTmp = document.getElementById(m_ID + '_t_title');
    if(!oTmp || !oMain.style || (oMain.style.position != 'absolute' && oMain.style.position != 'fixed') || oTmp.parentNode.style.cursor == 'default') return false;
    if((e.button && e.button != 1) || (e.which && e.which != 1)) return false;
    FTab_ActWin = oMain;
    FTab_ActWin.M_PosX = oMain.style.left.replace('px','')/1;
    FTab_ActWin.M_PosY = oMain.style.top.replace('px','')/1;
    FTab_ActWin.M_Moving = true;
    FTab_ActWin.M_MovingType = 1;

    if(FTab_TOUCH) {
      FTab_ActWin.M_InitX = e.changedTouches[0].pageX;
      FTab_ActWin.M_InitY = e.changedTouches[0].pageY;

      FTab_ActWin.M_DocMMove = document.ontouchmove;
      FTab_ActWin.M_DocMStop = document.ontouchend;
      document.ontouchmove = doMMove;
      document.ontouchend = doMUp;
    }
    else {
      FTab_ActWin.M_InitX = e.clientX;
      FTab_ActWin.M_InitY = e.clientY;

      FTab_ActWin.M_DocMMove = document.onmousemove;
      FTab_ActWin.M_DocMStop = document.onmouseup;
      document.onmousemove = doMMove;
      document.onmouseup = doMUp;
    }
    doMMask(e);
    return false;
  }
  this.doMUp = doMUp;
  function doMUp(e)
  {
    e = e||event;
    var m = document.getElementById(oMain.m_ID + '_mmask');
    if(m) m.style.display = 'none';
    if(!FTab_ActWin || !FTab_ActWin.M_Moving) return false;
    if(FTab_TOUCH) {
      document.ontouchmove = (FTab_ActWin.M_DocMMove ? FTab_ActWin.M_DocMMove : null);
      document.ontouchend = (FTab_ActWin.M_DocMStop ? FTab_ActWin.M_DocMStop : null);
    }
    else {
      document.onmousemove = (FTab_ActWin.M_DocMMove ? FTab_ActWin.M_DocMMove : null);
      document.onmouseup = (FTab_ActWin.M_DocMStop ? FTab_ActWin.M_DocMStop : null);
    }
    FTab_ActWin.M_Moving = false;
    if(FTab_ActWin.M_MovingType == 1){
      FTab_SaveConfig(FTab_ActWin.m_ID, false,FTab_ActWin.style.left.replace('px','')/1,FTab_ActWin.style.top.replace('px','')/1,false,false,false,false);
      var l = 0 + ( document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft );
      var t = 0 + ( document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop );
      oMain.M_FixX = oMain.offsetLeft - l;
      oMain.M_FixY = oMain.offsetTop - t;
    }
    else{
      if(FTab_ActWin.M_InitX != e.clientX || FTab_ActWin.M_InitY != e.clientY)
        FTab_SaveConfig(FTab_ActWin.m_ID, false,false,false,FTab_ActWin.style.width.replace('px','')/1,FTab_ActWin.style.height.replace('px','')/1,false,false);
    }
    return false;
  }
  this.doMMove = doMMove;
  function doMMove(e)
  {
    if(!FTab_ActWin || !FTab_ActWin.M_Moving) return false;
    if(window.getSelection) window.getSelection().removeAllRanges();
    else if(document.selection && document.selection.empty) document.selection.empty();
    if(document.all){
      e = event;
      if(e.button != 1) return doMUp(e);
    }
    else if(e.which != 1) return doMUp(e);
    var leftPos = 0;
    var topPos = 0;
    if(FTab_TOUCH) {
      leftPos = FTab_ActWin.M_PosX + e.changedTouches[0].pageX - FTab_ActWin.M_InitX;
      topPos = FTab_ActWin.M_PosY + e.changedTouches[0].pageY - FTab_ActWin.M_InitY;
    }
    else {
      leftPos = FTab_ActWin.M_PosX + e.clientX - FTab_ActWin.M_InitX;
      topPos = FTab_ActWin.M_PosY + e.clientY - FTab_ActWin.M_InitY;
    }
    if(topPos < 0) topPos = 0;
    if(leftPos < 0) leftPos = 0;
    if(FTab_ActWin.M_MovingType == 1){
      FTab_ActWin.style.left = leftPos + 'px';
      FTab_ActWin.style.top = topPos + 'px';
    }
    else{
      if(FTab_ActWin.M_StatusCnt >= 5){
        if(!FTab_ActWin.M_MinWidth || FTab_ActWin.M_MinWidth <= 0){
          minWidth(FTab_ActWin);
        }

        if(leftPos < FTab_ActWin.M_MinWidth) leftPos = FTab_ActWin.M_MinWidth;
        var oTmp = document.getElementById(FTab_ActWin.m_ID + '_m_table');
        var cur = oTmp.clientWidth;
        FTab_ActWin.tabPages[selectedIndex].style.width = leftPos + 'px';
        FTab_ActWin.style.width = leftPos + 'px';
        //if(cur >= oTmp.clientWidth - 10 && cur <= oTmp.clientWidth + 10){
        //  FTab_ActWin.tabPages[selectedIndex].style.width = oTmp.clientWidth + 'px';
        //  FTab_ActWin.style.width = oTmp.clientWidth + 'px';
        //  leftPos = oTmp.clientWidth;
        //}

        topPos -= FTab_ActWin.M_OffsetH;
        if(topPos < 6) topPos = 6;
        FTab_ActWin.tabPages[selectedIndex].style.height = topPos + 'px';
        FTab_ActWin.oBody.style.height = topPos + 'px';
        topPos += FTab_ActWin.M_OffsetH;
        FTab_ActWin.style.height = topPos + 'px';
        FTab_ActWin.tabPages[selectedIndex].style.height = (topPos-FTab_ActWin.M_OffsetH) + 'px';
        FTab_ActWin.oBody.style.height = (topPos-FTab_ActWin.M_OffsetH) + 'px';

        var oTmp2 = document.getElementById(FTab_ActWin.m_ID + '_i_ifrm');
        if(oTmp2){
          var oTmp = document.getElementById(m_ID + '_m_table');
          oTmp2.style.width = (oTmp.clientWidth+3) + 'px';
          oTmp2.style.height = (oTmp.clientHeight+3) + 'px';
        }

        FTab_ActWin.M_StatusCnt = 0;
        FTab_MMoveTimer();
      }
    }
    return false;
  }

  this.cancelEvent = cancelEvent;
  function cancelEvent()
  {
    return false;
  }

  //show TabPage
  this.show = show;
  function show(pageIndex)
  {
    if(!isValid()) return false;
    doBringToFront(null, oMain);
    if(typeof(pageIndex) == 'number' && pageIndex < tabPages.length && pageIndex >= 0){
      var curH = tabPages[selectedIndex].style.height;
      var curW = tabPages[selectedIndex].style.width;
      selectedIndex = pageIndex;
      FTab_SaveConfig(m_ID, selectedIndex,false,false,false,false,false,false);
      for(var i = 0; i < tabPages.length; i++)
      {
        var div = document.getElementById(m_ID + '_p_title' + i);
        var divr = document.getElementById(m_ID + '_p_r' + i);
        if(i == pageIndex){
          tabPages[i].style.display = '';
          if(div) div.className = 'ftab_act';
          if(divr) divr.className = 'ftab_actr';
          tabPages[i].style.width = curW;
          tabPages[i].style.height = curH;
        }
        else{
          tabPages[i].style.display = 'none';
          if(div) div.className = 'ftab_deact';
          if(divr) divr.className = 'ftab_deactr';
        }
      }
    }
    var m = null;
    if(oMain.modal && oMain.style.display == 'none'){
      var ind = FTab_M_Lst.length;
      var obj = new Object();
      obj.oMain = oMain;
      FTab_M_Lst[ind] = obj;
      m = document.getElementById('SFTab_popmask');
      if(!m){
        m = document.createElement('div');
        m.id = 'SFTab_popmask';
        document.body.insertBefore(m, document.body.firstChild);
        m.style.cssText = 'display:none;cursor:wait;position:absolute;z-index:99990;top: 0px;left: 0px;width: 100%;height: 100%;-moz-opacity:0.8; filter:alpha(opacity=80);background-color:transparent !important;background-image: url('+FTab_PATH+'maskbg.png) !important;background-repeat: repeat;';
      }
      FTab_MResize();
      if(ind > 0){
        //hide prev win
        var obj2 = FTab_M_Lst[ind-1];
        obj2.oMain.style.zIndex = m.style.zIndex/1 - 2;
      }
      m.style.display = '';
    }
    oMain.style.display = '';
    if(m){
      oMain.style.zIndex = 2 + m.style.zIndex/1;
    }

    minWidth(oMain);
    if(oMain.m_kcenter){
      moveCenter();
    }
    if(FTabs && typeof(FTabs.OnPageShow) == 'function'){
      try{
        FTabs.OnPageShow(oMain.objSelf, selectedIndex);
      }catch(e){}
    }
    return true;
  }

  this.switchMinMax = switchMinMax;
  function switchMinMax()
  {
    if(!isValid()) return false;
    doBringToFront();
    var oTmp = document.getElementById(m_ID + '_m_table');
    if(oTmp.rows.length < 2) return true;
    var headw = oTmp.clientWidth;

    if(oTmp.save_display && oTmp.save_display == 'none') oTmp.save_display = ''
    else{
      oTmp.save_display = 'none';
      oTmp.save_bheight = tabPages[selectedIndex].style.height;
      oTmp.save_height = oMain.style.height;
      oTmp.save_width = oMain.style.width;
    }
    var headh = oTmp.rows[0].clientHeight;
    for(var i = 1; i < oTmp.rows.length; i++){
      oTmp.rows[i].style.display = oTmp.save_display;
    }
    if(oTmp.save_display == 'none'){
      FTab_SaveConfig(m_ID, false,false,false,false,false,0,false);
      oMain.style.height = headh + 'px';
      if(headw > 0) oMain.style.width = (headw+2) + 'px';
      var oTmp2 = document.getElementById(m_ID + '_t_min');
      //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_max.gif';
      if(oTmp2) oTmp2.style.backgroundPosition = ''+((1+1) * -18)+'px '+((8+1) * -18)+'px';

      oTmp2 = document.getElementById(m_ID + '_t_pm');
      //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_plus.gif';
      if(oTmp2) oTmp2.style.backgroundPosition = ''+((8+1) * -18)+'px '+((8+1) * -18)+'px';

      oTmp2 = document.getElementById(m_ID + '_i_ifrm');
      if(oTmp2){
        oTmp2.style.height = headh + 'px';
        oTmp2.style.width = oMain.clientWidth + 'px';
      }
    }
    else{
      FTab_SaveConfig(m_ID, false,false,false,false,false,1,false);
      tabPages[selectedIndex].style.height = oTmp.save_bheight;
      oMain.style.height = oTmp.save_height;
      oMain.style.width = oTmp.save_width;
      var oTmp2 = document.getElementById(m_ID + '_t_min');
      //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_min.gif';
      if(oTmp2) oTmp2.style.backgroundPosition = ''+((0+1) * -18)+'px '+((8+1) * -18)+'px';

      oTmp2 = document.getElementById(m_ID + '_t_pm');
      //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_minus.gif';
      if(oTmp2) oTmp2.style.backgroundPosition = ''+((9+1) * -18)+'px '+((8+1) * -18)+'px';

      oTmp2 = document.getElementById(m_ID + '_i_ifrm');
      if(oTmp2){
        oTmp2.style.height = (oTmp.clientHeight+3) + 'px';
        oTmp2.style.width = (oTmp.clientWidth+3) + 'px';
      }
    }
    //group for expandAble
    var g = oMain.getAttribute('group');
    if(oTmp.save_display == '' && oMain.expandAble && typeof g == 'string' && g != ''){
      var r = FTab_GetWins();
      for(t in r){
        var oMain2 = r[t];
        if(oMain2 != oMain && oMain2.expandAble && !oMain2.objSelf.isMin() && typeof oMain2.getAttribute('group') == 'string' && oMain2.getAttribute('group') == g)
          oMain2.objSelf.switchMinMax();
      }
    }
    if(FTabs && typeof(FTabs.OnMinMax) == 'function'){
      try{
        FTabs.OnMinMax(oMain.objSelf, oTmp.save_display == 'none'); //ftab,isMin
      }catch(e){}
    }
    return true;
  }

  this.switchFixed = switchFixed;
  function switchFixed()
  {
    if(!isValid()) return false;
    doBringToFront();
    var oTmp2 = document.getElementById(m_ID + '_t_fix');
    if(oTmp2){
      if(oTmp2.m_fix){
        //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_fixed.gif';
        oTmp2.style.backgroundPosition = ''+((3+1) * -18)+'px '+((8+1) * -18)+'px';
        oTmp2.m_fix = false;
      }
      else{
        //if(oTmp2 && oTmp2.src) oTmp2.src = FTab_PATH+'ftab_fixed2.gif';
        oTmp2.style.backgroundPosition = ''+((4+1) * -18)+'px '+((8+1) * -18)+'px';
        oTmp2.m_fix = true;
      }
    }
    //not good while drag out of screen
    //if(FTab_MSIE){
      var l = 0 + ( document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft );
      var t = 0 + ( document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop );
      oMain.M_FixX = oMain.offsetLeft - l;
      oMain.M_FixY = oMain.offsetTop - t;
    //}
    //else{
    //  oMain.style.position = (oTmp2.m_fix ? 'fixed' : 'absolute');
    //}
    if(FTabs && typeof(FTabs.OnFixed) == 'function'){
      try{
        FTabs.OnFixed(oMain.objSelf, oTmp2.m_fix); //ftab,isFixed
      }catch(e){}
    }
    return true;
  }

  this.hide = hide;
  function hide()
  {
    if(!isValid()) return false;

    if(oMain.modal && (oMain.style.display == '' || oMain.style.display == 'block')){
      var m = document.getElementById('SFTab_popmask');
      var obj = FTab_M_Lst.pop();
      if(FTab_M_Lst.length > 0){
        var obj2 = FTab_M_Lst[FTab_M_Lst.length-1];
        //restore prev win
        obj2.oMain.style.zIndex = 2 + m.style.zIndex/1;
      }
      if(FTab_M_Lst.length <= 0){
        m.style.display = "none";
      }
    }

    oMain.style.display = 'none';
    if(FTabs && typeof(FTabs.OnHide) == 'function'){
      try{
        FTabs.OnHide(oMain.objSelf);
      }catch(e){}
    }
    return true;
  }

  this.setTitle = setTitle;
  function setTitle(str)
  {
    if(!isValid()) return false;
    var div = document.getElementById(m_ID + '_t_title');
    if(div) div.innerHTML = str;
    oMain.title = str;
    minWidth(oMain);
    return true;
  }

  this.setTabTitle = setTabTitle;
  function setTabTitle(pageIndex, str)
  {
    if(!isValid()) return false;
    if(typeof(pageIndex) == 'number' && pageIndex < tabPages.length && pageIndex >= 0){
      var div = document.getElementById(m_ID + '_p_title' + pageIndex);
      div.innerHTML = str;
      div.parentNode.title = str;
      tabPages[pageIndex].title = str;

      if(!oMain.noResize){
        var nTitleW = document.getElementById(m_ID + '_m_table').clientWidth;
        oMain.style.width = nTitleW + 'px';
        if(!FTab_MSIE) nTitleW -= 6;
        tabPages[pageIndex].style.width = nTitleW + 'px';
      }
      minWidth(oMain);
    }
    return true;
  }

  this.setBody = setBody;
  function setBody(pageIndex, str)
  {
    if(!isValid()) return false;
    if(typeof(pageIndex) == 'number' && pageIndex < tabPages.length && pageIndex >= 0) tabPages[pageIndex].innerHTML = str;
    minWidth(oMain);
    return true;
  }

  this.setURL = setURL;
  function setURL(pageIndex, url)
  {
    if(!isValid()) return false;
    if(typeof(pageIndex) == 'number' && pageIndex < tabPages.length && pageIndex >= 0){
      tabPages[pageIndex].style.cssText = 'overflow-x:hidden;overflow-y:hidden;' + tabPages[pageIndex].style.cssText;
      tabPages[pageIndex].innerHTML = '';
      var iframe = document.createElement('IFRAME');
      tabPages[pageIndex].style.cssText = 'margin:0px;padding:0px;' + tabPages[pageIndex].style.cssText;
      tabPages[pageIndex].appendChild(iframe);
      iframe.style.cssText = 'width:100%;height:100%;border:0;frameborder:no;';
      iframe.src = url;
      //TODO:do nothing next
      //iframe.onmousedown = doBringToFront;
      //good done at 2009/06/25
    }
    return true;
  }

  this.setStatus = setStatus;
  function setStatus(str)
  {
    if(!isValid()) return false;
    var div = document.getElementById(m_ID + '_s_title');
    if(div){
      div.innerHTML = str;
      minWidth(oMain);
    }
    return true;
  }

  //get selectedIndex
  this.getSelectedIndex = getSelectedIndex;
  function getSelectedIndex()
  {
    return selectedIndex;
  }

  this.isHide = isHide;
  function isHide()
  {
    if(!isValid()) return false;
    return (oMain.style.display == 'none');
  }

  this.isMin = isMin;
  function isMin()
  {
    if(!isValid()) return false;
    var oTmp = document.getElementById(m_ID + '_m_table');
    return (oTmp.save_display == 'none');
  }

  this.isFixed = isFixed;
  function isFixed()
  {
    if(!isValid()) return false;
    var oTmp2 = document.getElementById(m_ID + '_t_fix');
    return (oTmp2 && oTmp2.m_fix);
  }
  this.isKeepCenter = isKeepCenter;
  function isKeepCenter()
  {
    return (oMain.m_kcenter == true);
  }

  this.move = move;
  function move(left, top, width, height)
  {
    if(!isValid()) return false;
    if(typeof(left) == 'number') oMain.style.left = left + 'px';
    if(typeof(top) == 'number') oMain.style.top = top + 'px';

    var min = isMin();
    if(!min && typeof(width) == 'number'){
      if(!oMain.M_MinWidth || oMain.M_MinWidth <= 0){
        minWidth(oMain);
      }
      if(width < oMain.M_MinWidth) width = oMain.M_MinWidth;
      var oTmp = document.getElementById(m_ID + '_m_table');
      var cur = oTmp.clientWidth;
      tabPages[selectedIndex].style.width = width + 'px';
      oMain.style.width = width + 'px';
      if(cur == oTmp.clientWidth){
        tabPages[selectedIndex].style.width = oMain.M_MinWidth + 'px';
        oMain.style.width = oMain.M_MinWidth + 'px';
      }
    }

    if(!min && typeof(height) == 'number'){
      height -= oMain.M_OffsetH;
      if(height < 6) height = 6;
      tabPages[selectedIndex].style.height = height + 'px';
      oBody.style.height = height + 'px';
      height += oMain.M_OffsetH;
      oMain.style.height = height + 'px';
      tabPages[selectedIndex].style.height = (height-oMain.M_OffsetH) + 'px';
      oBody.style.height = (height-oMain.M_OffsetH) + 'px';
    }

    minWidth(oMain);
  }

  return this;
}
