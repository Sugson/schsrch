const React = require('react')
const getDocument = require('./lpdfjs.js')
const AppState = require('./appstate.js')
const FetchErrorPromise = require('./fetcherrorpromise.jsx')
const PaperUtils = require('./paperutils.js')
const { client2view } = require('./pointutils.js')
const { TransformationStage, PendingTransform } = require('./transformationstage.js')

class PaperViewer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      paperFileId: null,
      dirs: null,
      loadError: null,
      pdfs: null,
      initialLoadTime: null,
      dirMenu: null
    }

    this.paperDirHitRegions = null // [{y1, y2, dir}, ...]
    this.pdfjsViewerInstance = null

    this.handleAppStateUpdate = this.handleAppStateUpdate.bind(this)
    this.handlePDFUserMove = this.handlePDFUserMove.bind(this)
    this.handlePDFJSViewerPostDraw = this.handlePDFJSViewerPostDraw.bind(this)
    this.handlePDFJSViewerDownEvent = this.handlePDFJSViewerDownEvent.bind(this)
  }

  loadPaper (fileId) {
    if (this.state.paperFileId === fileId && !this.state.loadError) return
    this.setState({loadError: null, initialLoadTime: Date.now(), dirMenu: null})
    this.paperDirHitRegions = null
    if (this.state.paperFileId) {
      if (this.state.pdfs) {
        for (let t of Object.keys(this.state.pdfs)) {
          let pdf = this.state.pdfs[t]
          if (pdf.document) {
            pdf.document.destroy()
          }
          pdf = null
          delete this.state.pdfs[t]
        }
      }
      this.setState({
        dirs: null,
        pdfs: null
      })
    }

    this.setState({
      paperFileId: fileId
    })

    if (fileId) {
      fetch(`/dirs/batch/?docid=${encodeURIComponent(fileId)}&flattenEr=true`).then(FetchErrorPromise.then, FetchErrorPromise.error).then(res => res.json()).then(json => {
        if (this.state.paperFileId !== fileId) return

        try {
          let tCurrentType = AppState.getState().v2viewing.tCurrentType
          let sortedTypeStrArr = Object.keys(json).sort(PaperUtils.funcSortType)
          this.setState({pdfs: {}})
          for (let type of sortedTypeStrArr) {
            let docid = json[type].docid
            if (Array.isArray(json[type].dirs)) {
              json[type].dirs = json[type].dirs.map((d, i) => Object.assign(d, {i}))
            }
            if (json[type].type !== 'blob') {
              if (tCurrentType !== null && type === tCurrentType) {
                this.loadPDF(type, docid)
              } else {
                setTimeout(() => this.loadPDF(type, docid), 100)
              }
            }
          }
          this.setState({dirs: json})
          if (AppState.getState().v2viewing.tCurrentType === null && (!sortedTypeStrArr.includes('qp') || json.qp.type !== 'questions' || json.qp.dirs.length === 0)) {
            AppState.dispatch({type: 'v2view-set-tCurrentType', tCurrentType: sortedTypeStrArr[0]})
          }
        } catch (e) {
          this.setState({loadError: e})
        }
      }, err => {
        if (this.state.paperFileId !== fileId) return

        this.setState({loadError: err})
      })
    }
  }

  /**
   * @param {String} type qp, ms, er, etc...
   * @param {String} docid /doc/$docid/
   * @returns {Promise<undefined>} a promise that resolve iff the pdf is ready to be displayed.
   */
  loadPDF (type, docid) {
    if (!this.state.pdfs) throw new Error('this.state.pdfs is not an object.')
    return new Promise((resolve, reject) => {
      let obj = this.state.pdfs[type]
      if (!obj) {
        obj = {
          document: null,
          progress: 0,
          error: null,
          ready: false
        }
        this.state.pdfs[type] = obj
        getDocument({
          url: `/doc/${encodeURIComponent(docid)}/`,
          disableRange: false,
          rangeChunkSize: 100 * 1024
        }, loadingTask => {
          obj.loadingTask = loadingTask
          obj.loadingTask.onProgress = ({loaded, total}) => {
            if (Number.isFinite(loaded) && Number.isFinite(total) && loaded < total) {
              obj.progress = loaded / total
              this.forceUpdate()
            }
          }
          obj.loadingTask.promise.catch(err => {
            obj.error = err
            reject(err)
            this.forceUpdate()
          })
          obj.loadingTask.promise.then(pdfDocument => {
            obj.document = pdfDocument
            pdfDocument.getPage(1).then(() => {
              obj.ready = true
              this.forceUpdate()
            }, err => {})
            resolve()
            this.forceUpdate()
          })
        })
      } else {
        resolve()
      }
    })
  }

  componentDidMount () {
    this._appstateUnsub = AppState.subscribe(this.handleAppStateUpdate)
    this.handleAppStateUpdate()
  }

  componentWillUnmount () {
    // free resources
    this.loadPaper(null)
    this.pdfjsViewerInstance = null
    this._appstateUnsub()
    this._appstateUnsub = null
  }

  handleAppStateUpdate () {
    let v2viewing = AppState.getState().v2viewing
    if (!v2viewing) {
      this.loadPaper(null)
    } else {
      this.loadPaper(v2viewing.fileId)
    }
  }

  handlePDFUserMove (nTransform) {
    AppState.dispatch({type: 'v2view-user-move-page', stageTransform: nTransform})
  }

  render () {
    if (!this.state.paperFileId) return null
    if (this.state.loadError) {
      return (
        <div className='paperviewer'>
          <FetchErrorPromise.ErrorDisplay error={this.state.loadError} serverErrorActionText={'get document'} onRetry={() => this.loadPaper(this.state.paperFileId)} />
        </div>
      )
    }
    let v2viewing = AppState.getState().v2viewing
    if (!this.state.dirs) {
      let progress = Math.min(1, Math.log10((Date.now() - this.state.initialLoadTime + 70) / 70) / 2.17)
      requestAnimationFrame(() => this.forceUpdate())
      return (
        <div className='paperviewer loading'>
          <div className='loadingtitle'>Downloading&hellip;</div>
          <div className='loadingdesc'>Loading paper structure&hellip;</div>

          <div className='progressbar'>
            <div className='fill' style={{width: (progress * 100) + '%'}} />
          </div>
        </div>
      )
    } else {
      return (
        <div className='paperviewer loaded'>
          {v2viewing.showPaperSetTitle ? (
            <div className='papersetindicate'>
              {v2viewing.showPaperSetTitle}
            </div>
          ) : null}
          <div className='typebar'>
            {(() => {
              if (!this.state.dirs.qp) return null
              // The "ques" tab
              let current = v2viewing.tCurrentType === null
              return (
                <div className={'item' + (current ? ' current' : '')} onClick={evt => this.tSwitchTo(null)}>
                  ques
                </div>
              )
            })()}
            {this.state.dirs ? Object.keys(this.state.dirs).sort(PaperUtils.funcSortType).map(typeStr => {
              let obj = this.state.pdfs[typeStr]
              let dir = this.state.dirs[typeStr]
              let current = v2viewing.tCurrentType === typeStr
              if (!obj || dir.type === 'blob') {
                return (
                  <div className={'item' + (current ? ' current' : '')} key={typeStr}
                      onClick={evt => this.tSwitchTo(typeStr)}>
                    {typeStr}
                  </div>
                )
              }
              return (
                <div className={'item' + (current ? ' current' : '')} key={typeStr}
                  onClick={evt => this.tSwitchTo(typeStr)}>
                  {typeStr}{!obj.document ? '\u2026' : null}{current ? ':' : null}
                  {current ? (
                    <a
                      className='download'
                      href={'/doc/' + encodeURIComponent(this.state.dirs[v2viewing.tCurrentType].docid) + '/'}
                      target='_blank'>
                      pdf
                    </a>
                  ) : null}
                  {!obj.document || !obj.document.__fullyready ? <div className='loadingfill' style={{width: (obj.progress * 100) + '%'}} /> : null}
                </div>
              )
            }) : null}
          </div>
          {(() => {
            let tCurrentType = v2viewing.tCurrentType
            if (this.state.pdfs && tCurrentType !== null && this.state.pdfs[tCurrentType] && this.state.dirs[tCurrentType] && this.state.dirs[tCurrentType].type !== 'blob') {
              let obj = this.state.pdfs[tCurrentType]
              if (!obj.document || !obj.ready) {
                return (
                  <div className='pdfcontain loading'>
                    <div className='progressbar'>
                      <div className='fill' style={{width: (obj.progress * 100) + '%'}} />
                    </div>
                  </div>
                )
              } else {
                let menu = null
                if (this.state.dirMenu && this.pdfjsViewerInstance) {
                  let [aX, aY] = this.state.dirMenu.appearsMenuAt
                  aX = Math.max(0, Math.min(this.pdfjsViewerInstance.viewDim[0] - 80, aX))
                  aY = Math.max(0, aY)
                  let types = Object.keys(this.state.dirs).sort(PaperUtils.funcSortType)
                  let typeDisplayed = 0
                  menu = (
                    <div className='dirmenu' style={{
                      left: aX + 'px',
                      top: aY + 'px'
                    }}>
                      {types.map(typeStr => {
                        if (typeStr === tCurrentType) return null
                        if ((typeStr === 'ms' || typeStr === 'qp') && this.state.dirs[typeStr] && (this.state.dirs[typeStr].type === 'questions' || this.state.dirs[typeStr].type === 'mcqMs')) {
                          let dd = null
                          let isMcq = false
                          if (this.state.dirs[typeStr].type === 'questions') {
                            dd = this.state.dirs[typeStr].dirs.find(x => x.i === this.state.dirMenu.dir.i)
                          } else {
                            isMcq = true
                            dd = this.state.dirs[typeStr].dirs.find(x => x.qN === this.state.dirMenu.dir.qN)
                          }
                          if (!dd) return null
                          let go = evt => {
                            this.setState({dirMenu: null})
                            AppState.dispatch({
                              type: 'v2view-set-tCurrentType',
                              tCurrentType: typeStr,
                              viewDir: dd,
                              stageTransform: null
                            })
                          }
                          typeDisplayed ++
                          return (
                            <div className='item' key={typeStr} onClick={go}>{isMcq ? dd.qT : typeStr}</div>
                          )
                        }
                        if (typeStr === 'er' && this.state.dirs[typeStr].type === 'er-flattened') {
                          let dd = this.state.dirs[typeStr].dirs.find(x => x.qNs.includes(this.state.dirMenu.dir.qN))
                          if (!dd) return null
                          let go = evt => {
                            this.setState({dirMenu: null})
                            AppState.dispatch({
                              type: 'v2view-set-tCurrentType',
                              tCurrentType: typeStr,
                              viewDir: dd,
                              stageTransform: null
                            })
                          }
                          typeDisplayed ++
                          return (
                            <div className='item' key={typeStr} onClick={go}>{typeStr}</div>
                          )
                        }
                        return null
                      })}
                      {typeDisplayed === 0 ? (
                        <div className='item nothing'>
                          {'(///ᴗ///)'}
                        </div>
                      ) : null}
                    </div>
                  )
                }
                return (
                  <div className='pdfcontain'>
                    <PDFJSViewer
                      doc={obj.document}
                      dir={this.state.dirs[tCurrentType]}
                      onUserMove={this.handlePDFUserMove}
                      stageTransform={v2viewing.stageTransforms[tCurrentType]}
                      postDrawCanvas={this.handlePDFJSViewerPostDraw}
                      onDownEvent={this.handlePDFJSViewerDownEvent}
                      ref={f => this.pdfjsViewerInstance = f}
                      initToDir={v2viewing.viewDir} />
                    {!obj.document.__fullyready ? (
                      <div className='progressbar floating'>
                        <div className='fill' style={{width: (obj.progress * 100) + '%'}} />
                      </div>
                    ) : null}
                    {menu}
                  </div>
                )
              }
            } else if (tCurrentType === null) {
              let qdirs = this.state.dirs.qp
              let sortedTypeStrArr = Object.keys(this.state.dirs).sort(PaperUtils.funcSortType)
              if (!qdirs || qdirs.type !== 'questions') return null
              return (
                <div className='pdfcontain ques'>
                  <div className='h'>This paper contains {qdirs.dirs.length} questions.</div>
                  {qdirs.dirs.map(d => {
                    let qOnClick = evt => {
                      if (this.state.dirs.qp) {
                        let rDir = this.state.dirs.qp
                        if (rDir.type === 'questions' && rDir.dirs.length > d.i) {
                          let tDir = rDir.dirs[d.i]
                          AppState.dispatch({
                            type: 'v2view-set-tCurrentType',
                            tCurrentType: 'qp',
                            viewDir: tDir,
                            stageTransform: null
                          })
                        }
                      }
                    }
                    return (
                      <div className='question' key={d.i} onClick={qOnClick}>
                        <div className='left'>
                          <div className='num'>
                            {d.qN}
                          </div>
                        </div>
                        <div className='body'>
                          <div className='title'>
                            {d.qT}
                          </div>
                          <div className='jump'>
                            Goto:
                            {sortedTypeStrArr.map(ts => {
                              let rDir = this.state.dirs[ts]
                              if (rDir) {
                                let tDir = null
                                if (rDir.type === 'questions' && d.i < rDir.dirs.length) {
                                  tDir = rDir.dirs[d.i]
                                } else if (rDir.type === 'mcqMs') {
                                  tDir = rDir.dirs.find(x => x.qN === d.qN)
                                } else if (rDir.type === 'er-flattened') {
                                  tDir = rDir.dirs.find(x => x.qNs.includes(d.qN))
                                }
                                if (tDir) {
                                  let onClick = evt => {
                                    evt.stopPropagation()
                                    AppState.dispatch({
                                      type: 'v2view-set-tCurrentType',
                                      tCurrentType: ts,
                                      viewDir: tDir,
                                      stageTransform: null
                                    })
                                  }
                                  return (
                                    <a onClick={onClick} key={ts}>
                                      {ts}
                                    </a>
                                  )
                                }
                              }
                              return (
                                <a className='disabled' onClick={e => e.stopPropagation()} key={ts}>
                                  {ts}
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            } else if (this.state.dirs[tCurrentType] && this.state.dirs[tCurrentType].type === 'blob') {
              let fileType = this.state.dirs[tCurrentType].fileType
              return (
                <div className='pdfcontain blob'>
                  <div className='h'>Download this {PaperUtils.getTypeString(tCurrentType)}&hellip;</div>
                  <div className='dl'>
                    <a href={`/doc/${this.state.dirs[tCurrentType].docid}`} target='_blank'>Big download link</a>
                  </div>
                  (Opens in new window, this is a file with type {fileType})
                </div>
              )
            } else {
              return null
            }
          })()}
        </div>
      )
    }
    return (
      <div className='paperviewer'>
        Stub!
      </div>
    )
  }

  tSwitchTo (typeStr) {
    this.paperDirHitRegions = null
    this.setState({dirMenu: null})
    AppState.dispatch({type: 'v2view-set-tCurrentType', tCurrentType: typeStr})
  }

  handlePDFJSViewerPostDraw (drawnPages, ctx, stage, dpr) {
    this.paperDirHitRegions = null
    let v2viewing = AppState.getState().v2viewing
    let cDir = this.state.dirs[v2viewing.tCurrentType]
    if (cDir && cDir.type === 'questions') {
      this.paperDirHitRegions = []
      for (let p of drawnPages) {
        let pDirs = cDir.dirs.filter(x => x.page === p.pageIndex)
        for (let d of pDirs) {
          if (d.qNRect) {
            let r = d.qNRect
            let pagePoint1 = [r.x1, r.y1]
            let [tX, tY] = stage.stage2view([0, 1].map(c => pagePoint1[c] + p.stageOffset[c])).map(x => x * dpr)
            let [tW, tH] = [r.x2 - r.x1, r.y2 - r.y1].map(x => x * stage.scale * dpr)
            ctx.globalCompositeOperation = 'screen' // magic

            ctx.fillStyle = '#ff5722'
            ctx.fillRect(tX, tY, tW, tH)

            ctx.fillStyle = '#e91e63'
            ctx.fillRect(Math.max(0, tX + tW), tY, ctx.canvas.width, tH)

            ctx.globalCompositeOperation = 'multiply'
            ctx.fillRect(stage.stage2view(p.stageOffset)[0] * dpr, tY + tH, p.stageWidth * stage.scale * dpr, dpr)

            this.paperDirHitRegions.push({
              y1: tY / dpr,
              y2: (tY + tH) / dpr,
              dir: d
            })
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  handlePDFJSViewerDownEvent (evt) {
    if (!this.paperDirHitRegions || !this.pdfjsViewerInstance) return true
    this.setState({dirMenu: null})
    let y = null
    let canvasPoint = null
    if (evt.touches && evt.touches.length === 1) {
      let t = evt.touches[0]
      canvasPoint = client2view([t.clientX, t.clientY], this.pdfjsViewerInstance.paintCanvas)
      y = canvasPoint[1]
    } else if (!evt.touches) {
      canvasPoint = client2view([evt.clientX, evt.clientY], this.pdfjsViewerInstance.paintCanvas)
      y = canvasPoint[1]
    } else return true
    for (let hr of this.paperDirHitRegions) {
      if (y > hr.y1 && y < hr.y2) {
        if (evt.touches) {
          let cancel = () => {
            evt.target.removeEventListener('touchmove', moveHandler)
            evt.target.removeEventListener('touchend', endHandler)
            evt.target.removeEventListener('touchcancel', cancel)
          }
          let t = evt.touches[0]
          let moveHandler = evt => {
            if (evt.touches.length !== 1) return cancel()
            let t2 = evt.touches[0]
            if (t2.identifier !== t.identifier || Math.abs(t2.clientX - t.clientX) + Math.abs(t2.clientY - t.clientY) > 5) return cancel()
          }
          let endHandler = evt => {
            cancel()
            if (evt.touches.length === 0 || (evt.touches.length === 1 && evt.changedTouches.length === 1 && evt.touches[0].identifier === evt.changedTouches[0].identifier)) {
              this.showDirMenu(hr.dir, canvasPoint)
            }
          }
          evt.target.addEventListener('touchmove', moveHandler)
          evt.target.addEventListener('touchend', endHandler)
          evt.target.addEventListener('touchcancel', cancel)
        } else {
          this.showDirMenu(hr.dir, canvasPoint)
          return false
        }
      }
    }
  }

  showDirMenu (dir, appearsMenuAt) {
    this.setState({dirMenu: {dir, appearsMenuAt}})
  }
}

class PDFJSViewer extends React.Component {
  // No touching AppState.dispatch in this class.
  static get NOT_READY () {return 0}
  static get PARTIAL_READY () {return 1}
  static get READY () {return 2}
  constructor (props) {
    super(props)
    this.elem = null
    this.paintCanvas = null
    this.textLayersContain = null
    this.textLayers = []
    this.aframeMeasureSize = null
    this.viewDim = [0, 0]
    this.paintCanvas = null
    this.pdfjsDocument = null
    this.pages = null // [ManagedPage]
    this.readyState = PDFJSViewer.NOT_READY
    this.stage = new TransformationStage()
    this.scrollbar = null
    this.scrollbarTouchState = null
    this.scrollbarFloating = null

    this.measureViewDim = this.measureViewDim.bind(this)
    this.paint = this.paint.bind(this)
    this.deferredPaint = this.deferredPaint.bind(this)
    this.updatePages = this.updatePages.bind(this)
    this.handleStageDownEvent = this.handleStageDownEvent.bind(this)
    this.handleStageMoveEvent = this.handleStageMoveEvent.bind(this)
    this.handleStageAfterUserInteration = this.handleStageAfterUserInteration.bind(this)
    this.scrollBarHandleDown = this.scrollBarHandleDown.bind(this)
    this.scrollbarHandleMove = this.scrollbarHandleMove.bind(this)
    this.scrollbarHandleUp = this.scrollbarHandleUp.bind(this)
    this.scrollbarHandleWheel = this.scrollbarHandleWheel.bind(this)
    this.scrollbarHandleMouseWheel = this.scrollbarHandleMouseWheel.bind(this)
  }

  componentDidMount () {
    if (!this.elem) throw new Error('this.elem is ' + this.elem)
    this.paintCanvas = document.createElement('canvas')
    this.elem.appendChild(this.paintCanvas)
    this.textLayersContain = document.createElement('div')
    this.textLayersContain.className = 'textlayercontain'
    this.elem.appendChild(this.textLayersContain)
    this.measureViewDim()
    this.startSizeMeasurementAFrame()
    this.stage.bindTouchEvents(this.textLayersContain)
    this.scrollbar = document.createElement('div')
    this.scrollbar.className = 'scrollbar'
    this.elem.appendChild(this.scrollbar)
    let scrollbarLine = document.createElement('div')
    scrollbarLine.className = 'line'
    this.scrollbar.appendChild(scrollbarLine)
    this.scrollbarFloating = document.createElement('div')
    this.scrollbarFloating.className = 'floating'
    this.scrollbar.appendChild(this.scrollbarFloating)
    let noPassiveEventsArgument = AppState.browserSupportsPassiveEvents ? {passive: false} : false
    this.scrollbar.addEventListener('mousedown', this.scrollBarHandleDown, noPassiveEventsArgument)
    this.scrollbar.addEventListener('touchstart', this.scrollBarHandleDown, noPassiveEventsArgument)
    this.scrollbar.addEventListener('touchmove', this.scrollbarHandleMove, noPassiveEventsArgument)
    this.scrollbar.addEventListener('touchend', this.scrollbarHandleUp, noPassiveEventsArgument)
    this.scrollbar.addEventListener('touchcancel', this.scrollbarHandleUp, noPassiveEventsArgument)
    this.scrollbar.addEventListener('wheel', this.scrollbarHandleWheel, noPassiveEventsArgument)
    this.scrollbar.addEventListener('mousewheel', this.scrollbarHandleMouseWheel, noPassiveEventsArgument)
    this.stage.onUpdate = this.deferredPaint
    this.stage.onAfterUserInteration = this.handleStageAfterUserInteration
    this.stage.onDownEvent = this.handleStageDownEvent
    this.stage.onMoveEvent = this.handleStageMoveEvent

    this.setDocument(this.props.doc)
  }

  handleStageAfterUserInteration () {
    if (this.readyState === PDFJSViewer.READY) {
      this.updatePages()
    }

    if (this.props.onUserMove) {
      this.props.onUserMove(this.stage.animationGetFinalState().boundInContentBox())
    }
  }

  componentDidUpdate () {
    this.setDocument(this.props.doc)

    if (this.readyState === PDFJSViewer.READY) {
      if (this.props.stageTransform) {
        this.checkPropStageTransform()
      } else if (this.props.initToDir) {
        this.getInitDirPendingTransform(this.props.initToDir).startAnimation(400)
      }

      this.updatePages()
    }
  }

  checkPropStageTransform () {
    let currentTransform = this.stage.animationGetFinalState()
    let targetTransform = this.props.stageTransform
    if (targetTransform.time <= currentTransform.time) return
    if (!currentTransform.simillarTo(targetTransform) && !this.stage.pressState) {
      targetTransform.startAnimation(400)
    }
  }

  startSizeMeasurementAFrame () {
    if (this.aframeMeasureSize !== null) {
      cancelAnimationFrame(this.aframeMeasureSize)
      this.aframeMeasureSize = null
    }
    this.aframeMeasureSize = requestAnimationFrame(this.measureViewDim)
  }
  measureViewDim () {
    let cStyle = window.getComputedStyle(this.elem)
    let newDim = [parseInt(cStyle.width), parseInt(cStyle.height)]
    let oldDim = this.viewDim
    if (Math.abs(oldDim[0] - newDim[0]) >= 1 || Math.abs(oldDim[1] - newDim[1]) >= 1) {
      this.viewDim = newDim
      this.handleViewportSizeUpdate()
    }
    this.aframeMeasureSize = null
    this.startSizeMeasurementAFrame()
  }

  handleViewportSizeUpdate () {
    let [w, h] = this.viewDim
    if (this.scrollbarTouchState) {
      this.scrollbarTouchRelease()
    }
    let dpr = window.devicePixelRatio
    this.paintCanvas.width = w * dpr
    this.paintCanvas.height = h * dpr
    Object.assign(this.paintCanvas.style, {
      width: w + 'px',
      height: h + 'px'
    })
    let lastViewportSize = this.stage.viewportSize
    this.stage.setViewportSize(w, h)
    if (lastViewportSize[0] < 1 || lastViewportSize[1] < 1 || this.stage.scale < 0.001) {
      this.initStagePosAndSize()
      return
    }
    this.paint()
    let pendingTransform = this.stage.animationGetFinalState().boundInContentBox()
    if (lastViewportSize[0] < 1) {
      pendingTransform.applyImmediate()
    } else {
      pendingTransform.startAnimation(100)
    }
  }

  componentWillUnmount () {
    document.removeEventListener('mousemove', this.scrollbarHandleMove)
    document.removeEventListener('mouseup', this.scrollbarHandleUp)
    if (this.aframeMeasureSize !== null) {
      cancelAnimationFrame(this.aframeMeasureSize)
      this.aframeMeasureSize = null
    }
    this.setDocument(null)
    this.stage.removeTouchEvents(this.textLayersContain)
    this.stage.destroy()
    this.stage = null
    this.paintCanvas.width = this.paintCanvas.height = 0
    this.paintCanvas.remove()
    this.paintCanvas = null
  }

  render () {
    return (
      <div className='pdfjsviewer' ref={f => this.elem = f} />
    )
  }

  setDocument (doc) {
    if (this.pdfjsDocument === doc) return
    this.readyState = PDFJSViewer.NOT_READY
    this.pdfjsDocument = doc
    if (this.pages) {
      for (let p of this.pages) {
        p.destroy()
      }
      delete this.pages
    }
    this.textLayersContain.innerHTML = ''
    this.textLayers = []
    this.pages = []
    if (doc) {
      this.initDocument()
    }
  }

  async initDocument () {
    let doc = this.pdfjsDocument
    let pages = this.pages
    for (let i = 0; i < doc.numPages; i ++) {
      if (this.pages !== pages) return
      let pdfjsPage = await doc.getPage(i + 1)
      if (this.pages !== pages) return
      pages[i] = new ManagedPage(pdfjsPage)
      console.log(`Creating ManagedPage for page ${i}...`)
      this.layoutDocument()
      this.readyState = PDFJSViewer.PARTIAL_READY
    }
    doc.__fullyready = true
    if (this.pages !== pages) return
    this.layoutDocument()
    this.initStagePosAndSize()
  }

  layoutDocument () {
    let pages = this.pages
    let maxW = 0
    for (let page of pages) {
      if (page.stageWidth > maxW) maxW = page.stageWidth
    }
    let cY = 0
    for (let page of pages) {
      page.stageOffset = [maxW / 2 - page.stageWidth / 2, cY]
      cY += page.stageHeight
    }
    let totalPages = this.pdfjsDocument.numPages
    if (totalPages > pages.length) {
      cY += (totalPages - pages.length) * (cY / pages.length)
    }
    this.stage.setContentSize(maxW, cY)
    this.paint()
  }

  initStagePosAndSize () {
    if (!this.pages) return
    let firstPage = this.pages[0]
    if (!firstPage) return
    if (!this.props.initToDir) {
      if (!this.props.stageTransform) {
        this.stage.putOnCenter([firstPage.stageOffset[0], firstPage.stageOffset[1] - 10, firstPage.stageWidth, firstPage.stageHeight + 20])
                    .applyImmediate()
      } else {
        new PendingTransform(this.props.stageTransform.nTranslate, this.props.stageTransform.nScale, this.stage)
          .applyImmediate()
      }
    } else {
      this.getInitDirPendingTransform(this.props.initToDir).applyImmediate()
    }
    this.handleStageAfterUserInteration()
    this.paint()
    this.forceUpdate()
    this.readyState = PDFJSViewer.READY
  }

  /**
    * @param dd only need {page, qNRect}. Can be faked.
    */
  getInitDirPendingTransform (dd) {
    let rPage = this.pages[dd.page]
    if (!rPage) {
      return this.stage.animationGetFinalState()
    } else {
      if (!dd.qNRect) {
        return this.stage.putOnCenter([rPage.stageOffset[0], rPage.stageOffset[1] - 10, rPage.stageWidth, rPage.stageHeight + 20])
      } else {
        let stageY = rPage.stageOffset[1] + dd.qNRect.y1 - 5 - rPage.clipRectangle[1]
        let centerPendingT = this.stage.putOnCenter([rPage.stageOffset[0] + dd.qNRect.x1 - 5 - rPage.clipRectangle[0], stageY,
                                rPage.stageWidth - dd.qNRect.x1 + rPage.clipRectangle[0], rPage.stageHeight / 2])
        return centerPendingT.setTranslate([null, -stageY * centerPendingT.nScale])
      }
    }
  }

  paint () {
    let ctx = this.paintCanvas.getContext('2d', {alpha: false})
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height)
    let dpr = Math.round(this.paintCanvas.width / this.viewDim[0] * 1000) / 1000
    if (!this.pages) return
    let stage = this.stage
    let drawnPages = []
    for (let i = 0; i < this.pages.length; i ++) {
      let p = this.pages[i]
      if (!this.pageInView(p)) {
        if (this.textLayers[i]) {
          this.textLayers[i].remove()
          this.textLayers[i] = null
        }
        continue
      }
      let [cssX, cssY] = stage.stage2view(p.stageOffset)
      let [x, y] = [cssX, cssY].map(x => x * dpr)
      let scale = stage.scale
      let [cssW, cssH] = [p.stageWidth * scale, p.stageHeight * scale]
      let [w, h] = [cssW, cssH].map(x => x * dpr)
      if (!p.renderedCanvas) {
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.stroke()
        p.render(this.documentRenderingScale).then(this.deferredPaint)
        if (this.textLayers[i]) {
          this.textLayers[i].remove()
          this.textLayers[i] = null
        }
      } else {
        drawnPages.push(p)
        let pageRenderredCanvasScale = p.renderedCanvas.width / p.initWidth
        let [sx, sy, sw, sh] = p.clipRectangle.map(x => x * pageRenderredCanvasScale)
        if (Math.abs(sw - w) <= 1) w = sw
        if (Math.abs(sh - h) <= 1) h = sh
        ctx.drawImage(p.renderedCanvas, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), Math.round(x), Math.round(y), Math.round(w), Math.round(h))
        if (!stage.currentAnimation && !stage.pressState) {
          if (p.textLayer) {
            if (this.textLayers[i] != p.textLayer) {
              if (this.textLayers[i]) {
                this.textLayers[i].remove()
              }
              this.textLayers[i] = p.textLayer
              this.textLayersContain.appendChild(p.textLayer)
            }
            if (!stage.pressState && !stage.currentAnimation) {
              let cssTScale = cssW / sw
              Object.assign(this.textLayers[i].style, {
                position: 'absolute',
                left: cssX + 'px',
                top: cssY + 'px',
                transformOrigin: 'top left',
                transform: 'scale(' + cssTScale + ')'
              })
            }
          } else {
            if (this.textLayers[i]) {
              this.textLayers[i].remove()
              this.textLayers[i] = null
            }
          }
        }
      }
    }
    if (this.props.postDrawCanvas) {
      this.props.postDrawCanvas(drawnPages, ctx, stage, dpr)
    }
    let y1 = stage.view2stage([0, 0])[1]
    let y2 = stage.view2stage([0, stage.viewportSize[1]])[1]
    let yTot = stage.contentSize[1]
    let sbLen = this.viewDim[1] - 40
    let y1sb = 20 + (y1 / yTot) * sbLen
    let y2sb = this.viewDim[1] - (20 + (y2 / yTot) * sbLen)
    this.scrollbarFloating.style.top = y1sb + 'px'
    this.scrollbarFloating.style.bottom = y2sb + 'px'
  }

  deferredPaint () {
    if (!this.paintAniFrame) {
      this.paintAniFrame = requestAnimationFrame(() => {
        this.paintAniFrame = null
        this.paint()
      })
    }
  }

  get documentRenderingScale () {
    return this.stage.animationGetFinalState().nScale * window.devicePixelRatio
  }

  updatePages () {
    if (!this.pages) return
    for (let p of this.pages) {
      if (this.pageInView(p)) {
        p.render(this.documentRenderingScale).then(this.deferredPaint)
      } else {
        p.freeCanvas()
      }
    }
  }

  pageInView (p) {
    let stage = this.stage
    let y1 = stage.stage2view(p.stageOffset)[1]
    let y2 = stage.stage2view([0, p.stageOffset[1] + p.stageHeight])[1]
    let yTop = 0
    let yBottom = stage.viewportSize[1]

    if (yTop > y2 || yBottom < y1) {
      return false
    } else {
      return true
    }
  }

  handleStageDownEvent (evt) {
    if (this.props.onDownEvent) {
      if (this.props.onDownEvent(evt) === false) {
        return false
      }
    }
    if (!evt.touches && window.getComputedStyle(evt.target).cursor === 'text') return false
    return true
  }

  handleStageMoveEvent (evt) {
    if (evt.touches && evt.touches.length === 1) {
      if (window.getSelection().toString().trim().length > 0) return false
    }
  }

  scrollBarHandleDown (evt) {
    document.removeEventListener('mousemove', this.scrollbarHandleMove)
    document.removeEventListener('mouseup', this.scrollbarHandleUp)
    if (this.props.onDownEvent) {
      if (this.props.onDownEvent(evt) === false) {
        return false
      }
    }
    evt.preventDefault()
    if (this.scrollbarTouchState)
      this.scrollbarTouchRelease()

    if (evt.touches) {
      if (evt.touches.length === 1) {
        let t = evt.touches[0]
        this.scrollbarTouchState = {
          touchId: t.identifier
        }
        this.scrollBarUpdatePoint([t.clientX, t.clientY])
      }
    } else {
      this.scrollbarTouchState = {
        touchId: null
      }
      this.scrollBarUpdatePoint([evt.clientX, evt.clientY])
      document.addEventListener('mousemove', this.scrollbarHandleMove)
      document.addEventListener('mouseup', this.scrollbarHandleUp)
    }
  }

  scrollbarHandleMove (evt) {
    if (!this.scrollbarTouchState) return
    evt.preventDefault()

    if (!this.scrollbarHandleMove_animationFrame) {
      this.scrollbarHandleMove_animationFrame = requestAnimationFrame(() => {
        this.scrollbarHandleMove_animationFrame = null

        if (evt.touches) {
          if (evt.touches.length === 1) {
            let t = evt.touches[0]
            if (t.identifier === this.scrollbarTouchState.touchId) {
              this.scrollBarUpdatePoint([t.clientX, t.clientY])
            } else {
              this.scrollbarTouchRelease()
            }
          } else {
            this.scrollbarTouchRelease()
          }
        } else {
          this.scrollBarUpdatePoint([evt.clientX, evt.clientY])
        }
      })
    }
  }

  scrollBarUpdatePoint (point) {
    let cY = client2view(point, this.scrollbar)[1]
    let sH = this.viewDim[1]
    if (cY < 20) cY = 20
    if (cY > sH - 21) cY = sH - 21

    if (!this.scrollbarTouchState) return
    let indicator = this.scrollbarTouchState.indicator
    if (!indicator) {
      indicator = document.createElement('div')
      this.scrollbarTouchState.indicator = indicator
      this.scrollbar.appendChild(indicator)
      indicator.className = 'indicator'
    }
    indicator.style.top = cY + 'px'
    indicator.innerHTML = '&nbsp;'
    let p = (cY - 20) / (sH - 40)
    if (this.pages && this.pages.length > 0) {
      let cPage = Math.floor(p * this.pages.length)
      if (!this.props.dir) {
        indicator.innerHTML = 'go to page <b>' + (cPage + 1) + '</b>'
      } else {
        let dir = this.props.dir
        if (dir.type === 'questions') {
          let questions = []
          for (let q of dir.dirs) {
            if (q.page === cPage) {
              questions.push(q)
            }
          }
          if (questions.length > 0) {
            indicator.innerHTML = `go to page <b>${cPage + 1}</b> (question${questions.length > 1 ? 's' : ''} ${questions.map(x => `<b>${parseInt(x.qN)}</b>`).join(', ')})`
          } else {
            let lastQuestion = dir.dirs.filter(q => q.page < cPage).slice(-1)[0]
            if (lastQuestion) {
              indicator.innerHTML = `go to page <b>${cPage + 1}</b> (question ${parseInt(lastQuestion.qN)} continued)`
            } else {
              indicator.innerHTML = `go to page <b>${cPage + 1}</b>`
            }
          }
        } else {
          indicator.innerHTML = 'go to page <b>' + (cPage + 1) + '</b>'
        }
      }
      this.scrollbarTouchState.gotoPage = cPage
    }
  }

  scrollbarTouchRelease () {
    document.removeEventListener('mousemove', this.scrollbarHandleMove)
    document.removeEventListener('mouseup', this.scrollbarHandleUp)
    if (this.scrollbarTouchState) {
      if (this.scrollbarTouchState.indicator) {
        this.scrollbarTouchState.indicator.remove()
      }
    }
    this.scrollbarTouchState = null
    if (this.scrollbarHandleMove_animationFrame) {
      cancelAnimationFrame(this.scrollbarHandleMove_animationFrame)
      this.scrollbarHandleMove_animationFrame = null
    }
  }

  scrollbarHandleUp (evt) {
    try {
      if (Number.isSafeInteger(this.scrollbarTouchState.gotoPage)) {
        let cPage = this.scrollbarTouchState.gotoPage
        let pageY = this.pages[cPage].stageOffset[1] - 5
        let pt = this.stage.animationGetFinalState()
        pt = new PendingTransform([pt.nTranslate[0], -pageY * pt.nScale], pt.nScale, this.stage).boundInContentBox()
        pt.startAnimation(200)
      }
    } catch (e) {
      console.error(e)
    }
    this.scrollbarTouchRelease()
    evt.preventDefault()
  }

  scrollbarHandleWheel (evt) {
    evt.preventDefault()
  }

  scrollbarHandleMouseWheel (evt) {
    evt.preventDefault()
  }
}

class ManagedPage {
  constructor (pdfjsPage) {
    this.pdfjsPage = pdfjsPage
    this.unitViewport = pdfjsPage.getViewport(1)
    this.initWidth = this.unitViewport.width
    this.initHeight = this.unitViewport.height
    this.stageOffset = [0, 0]
    this.clipRectangle = [0, 0, this.initWidth, this.initHeight] // [x, y, w, h]
    this.pageIndex = pdfjsPage.pageIndex
    this.renderedCanvas = null
    this.textContent = null
    this.textLayer = null
    this.renderedScale = null
    this.renderTask = null
    this.renderringScale = null
  }

  get stageWidth () {
    return this.clipRectangle[2]
  }
  get stageHeight () {
    return this.clipRectangle[3]
  }

  destroy () {
    this.pdfjsPage.cleanup()
    this.pdfjsPage = null
  }

  render (scale) {
    if (scale > 10) scale = 10 // avoid excessive memory usage
    if (scale === 0) return Promise.resolve()
    if (this.renderedScale && this.renderedCanvas && Math.abs(this.renderedScale - scale) < 0.00001) return Promise.resolve()
    if (this.renderringScale && Math.abs(this.renderringScale - scale) < 0.00001) return Promise.resolve()
    console.log('Rendering page ' + this.pdfjsPage.pageNumber)
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    this.renderringScale = scale
    let nCanvas = document.createElement('canvas')
    let viewport = this.pdfjsPage.getViewport(scale)
    nCanvas.width = viewport.width
    nCanvas.height = viewport.height
    let ctx = nCanvas.getContext('2d', {alpha: false})
    let renderTask = this.pdfjsPage.render({
      enableWebGL: true,
      canvasContext: ctx,
      viewport,
      renderInteractiveForms: false
    })
    this.renderTask = renderTask
    return renderTask.then(() => {
      if (this.renderTask !== renderTask) {
        ctx = null
        nCanvas.width = nCanvas.height = 0
        nCanvas = null
        return Promise.resolve()
      }
      this.renderringScale = null
      this.renderedScale = scale
      this.renderedCanvas = nCanvas
      this.textContent = null
      this.textLayer = null
      return this.pdfjsPage.getTextContent({
        disableCombineTextItems: false
      }).then(tc => {
        if (this.renderTask !== renderTask) {
          return Promise.resolve()
        }
        this.textContent = tc
        if (window.pdfjsLib) {
          this.textLayer = document.createElement('div')
          let nViewport = viewport.clone()
          nViewport.offsetX = viewport.offsetX - this.clipRectangle[0] * scale
          nViewport.offsetY = viewport.offsetY - this.clipRectangle[1] * scale
          nViewport = nViewport.clone() // to recalculate transformation matrix and stuff
          pdfjsLib.renderTextLayer({
            textContent: tc,
            container: this.textLayer,
            viewport: nViewport,
            enhanceTextSelection: true,
          })
          this.textLayer.style.width = (this.clipRectangle[2] * scale) + 'px'
          this.textLayer.style.height = (this.clipRectangle[3] * scale) + 'px'
          this.textLayer.style.overflow = 'hidden'
        }
        return Promise.resolve()
      }, () => Promise.resolve())
    }, () => {})
  }

  freeCanvas () {
    this.renderringScale = this.renderedScale = null
    if (this.renderTask) {
      this.renderTask.cancel()
      this.renderTask = null
    }
    if (this.renderedCanvas) {
      console.log('Freeing cache for page ' + this.pdfjsPage.pageNumber)
      this.renderedCanvas.width = this.renderedCanvas.height = 0
      delete this.renderedCanvas
    }
    if (this.textLayer) {
      this.textLayer.innerHTML = ''
      this.textLayer.remove()
      this.textLayer = null
    }
    this.textContent = null
  }
}

module.exports = PaperViewer
