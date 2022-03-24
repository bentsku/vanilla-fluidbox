// choice is made to not use custom event/listener as for now, might be add later
import throttle from "lodash/throttle"

const defaults = {
  immediateOpen: false,
  loader: false,
  maxWidth: 0,
  maxHeight: 0,
  resizeThrottle: 500,
  stackIndex: 1000,
  stackIndexDelta: 10,
  viewportFill: 0.95
}

const globalData = {}

let fbInstance = 0


const getElementData = (element) => {
  const options = {}

  Object.entries(element.dataset).forEach((k, v) => {
    key = k.replace('fluidbox', '')
    if (key !== '' || key !== null) {
      // Coerce boolean values
      if (v == 'false') {
        v = false;
      } else if (v == 'true') {
        v = true;
      }
      options[key] = v;
    }
  })
  return options
}

function wrapInner (parentElement, wrapperElement) {
  parentElement.appendChild(wrapperElement)

  while (parentElement.firstChild !== wrapperElement) {
    wrapperElement.appendChild(parentElement.firstChild);
  }
}

const elementPosition = (elmt) => {
  const rect = elmt.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
  }
}

const checkURL = (url) => {
  let exitCode = 0
  if (/[\s+]/g.test(url)) {
    console.warn('Fluidbox: Fluidbox opening is halted because it has detected characters in your URL string that need to be properly encoded/escaped. Whitespace(s) have to be escaped manually. See RFC3986 documentation.');
    exitCode = 1
  } else if (/[\"\'\(\)]/g.test(url)) {
    console.warn('Fluidbox: Fluidbox opening will proceed, but it has detected characters in your URL string that need to be properly encoded/escaped. These will be escaped for you. See RFC3986 documentation.');
    exitCode = 0
  }
  return exitCode;
}

const formatURL = (url) => {
  return url
    .replace(/"/g, '%22')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}


export const createFluidBox = (element, options) => {
  let instanceData = {}
  let img = null
  let fluidBoxWrapper, fluidBoxGhost, fluidBoxThumb, fluidBoxLoader
  // add fluidbox elements here to save the lookup everytime !! wrapper/ghost/img + conditional loader

  const settings = Object.assign({}, defaults, options, getElementData(element))
  // Coerce settings
  settings.viewportFill = Math.max(Math.min(parseFloat(settings.viewportFill), 1), 0)
  if (settings.stackIndex < settings.stackIndexDelta) {
    settings.stackIndexDelta = settings.stackIndex
  }

  const setDomElement = () => {
    fluidBoxWrapper = document.createElement('div')
    fluidBoxWrapper.classList.add('fluidbox__wrap')
    fluidBoxWrapper.style.zIndex = settings.stackIndex - settings.stackIndexDelta

    // update element
    element.classList.add('fluidbox--closed')
    wrapInner(element, fluidBoxWrapper)
    const img = element.querySelector('img')
    img.style.opacity = 1
    img.classList.add('fluidbox__thumb')

    fluidBoxGhost = document.createElement('div')
    fluidBoxGhost.classList.add('fluidbox__ghost')
    // insert ghost after img 
    img.after(fluidBoxGhost)

    if (settings.loader) {
      fluidBoxLoader = document.createElement('div')
      fluidBoxLoader.classList.add('fluidbox__loader')
      fluidBoxLoader.style.zIndex = 2
      fluidBoxWrapper.appendChild(fluidBoxLoader)
    }
  }

  const prepareFluidBox = () => {
    measure.fluidboxElements()
    bindEvents()
    element.classList.add('fluidbox--ready')
    bindListeners()
  }

  const measure = {
    viewport: () => {
      globalData.viewport = {
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight
      }
    },
    fluidboxElements: () => {
      instanceData.thumb = {
        natW: fluidBoxThumb.naturalWidth,
        natH: fluidBoxThumb.naturalHeight,
        w: fluidBoxThumb.width,
        h: fluidBoxThumb.height
      }
      fluidBoxGhost.style.width = `${fluidBoxThumb.width}px`
      fluidBoxGhost.style.height = `${fluidBoxThumb.height}px`
      // maybe use translate??
      const { top: imgTop, left: imgLeft } = elementPosition(fluidBoxThumb)
      const { top: wrapTop, left: wrapLeft } = elementPosition(fluidBoxWrapper)
      const imgStyle = fluidBoxThumb.style
      fluidBoxGhost.style.top = `${imgTop - wrapTop + parseInt(imgStyle.borderTopWidth) + parseInt(imgStyle.paddingTop)}px`
      fluidBoxGhost.style.left = `${imgLeft - wrapLeft + parseInt(imgStyle.borderLeftWidth) + parseInt(imgStyle.paddingLeft)}px`
    }
  }

  // PUBLIC METHODS
  // add later
  // Only perform initialization when
  // - It is not yet initialized
  // + DOM checks are satisfied:
  // +-- An anchor element is selected
  // +-- Contains one and only one child
  // +-- The only child is an image element OR a picture element
  // +-- The element must not be hidden (itself or its parents)
  const init = () => {
    fluidBoxThumb = element.querySelector('img')
    measure.viewport()
    if (
      (Object.keys(instanceData).length !== 0 || !instanceData.initialized) &&
      (
        element.matches('a') &&
        element.childElementCount === 1 &&
        (
          element.firstChild.matches('img') || (
            element.firstChild.matches('picture')
            && element.querySelectorAll('img').length === 1
          )
        ) &&
        element.style.display !== 'none' &&
        element.firstChild.style.display !== 'none' &&
        element.parentElement.style.display !== 'none'
      )
    ) {
      element.classList.remove('fluidbox--destroyed')
      instanceData = {}
      instanceData.initialized = true
      instanceData.originalNode = element.innerHTML

      fbInstance += 1
      instanceData.id = fbInstance
      element.classList.add('fluidbox__instance-' + fbInstance, 'fluidbox--initialized')

      setDomElement()

      // Wait for image to load, but only if image is not found in cache
      img = new Image()
      if (fluidBoxThumb.width > 0 && fluidBoxThumb.height > 0) {
        // Thumbnail loaded from cache, let's prepare fluidbox
        prepareFluidBox()
      } else {
        img.onload = function () {
          // Thumbnail loaded, let's prepare fluidbox
          prepareFluidBox()
        };
        img.onerror = function () {
          console.warn('Error loading the img')
        };
        img.src = fluidBoxThumb.src
      }
    }
    return img
  }

  function hideFluidbox () {
    const fluidboxOverlay = element.querySelector('.fluidbox__overlay')
    fluidBoxGhost.style.opacity = 0
    fluidBoxThumb.style.opacity = 1
    fluidboxOverlay.remove()
    fluidBoxWrapper.style.zIndex = settings.stackIndex - settings.stackIndexDelta
  }


  const open = () => {

    instanceData.state = 1
    fluidBoxGhost.removeEventListener('transitionend', hideFluidbox)

    document.querySelectorAll('.fluidbox--opened').forEach(elmt => {
      elmt.dispatchEvent(new Event('fluidbox-close'))
    })

    let fluidboxOverlay = element.querySelector('.fluidbox__overlay')
    if (!fluidboxOverlay) {
      fluidboxOverlay = document.createElement('div')
      fluidboxOverlay.classList.add('fluidbox__overlay')
      fluidboxOverlay.style.zIndex = -1
      fluidBoxWrapper.appendChild(fluidboxOverlay)
    }

    element.classList.remove('fluidbox--closed')
    element.classList.add('fluidbox--loading')

    if (checkURL(fluidBoxThumb.src)) {
      close()
      return false
    }

    fluidBoxGhost.style.backgroundImage = `url('${formatURL(fluidBoxThumb.src)}')`
    fluidBoxGhost.style.opacity = 1

    measure.fluidboxElements()

    if (settings.immediateOpen) {
      element.classList.add('fluidbox--opened', 'fluidbox--loaded')
      fluidBoxWrapper.style.zIndex = settings.stackIndex + settings.stackIndexDelta

      compute()
      fluidBoxThumb.style.opacity = 0
      fluidboxOverlay.style.opacity = 1

      img = new Image()
      img.onload = function () {
        if (instanceData.state === 1) {
          instanceData.thumb.natW = img.naturalWidth
          instanceData.thumb.natH = img.naturalHeight

          element.classList.remove('fluidbox--loading')
          if (checkURL(img.src)) {
            close({ error: true })
            return false
          }
          fluidBoxGhost.style.backgroundImage = `url('${formatURL(img.src)}'`

          compute()
        }
      }
      img.onerror = function () {
        close({ error: true })
      }
      img.src = element.getAttribute('href')

    } else {
      img = new Image()
      img.onload = function () {
        element.classList.remove('fluidbox--loading')
        element.classList.add('fluidbox--opened', 'fluidbox--loaded')
        fluidBoxWrapper.style.zIndex = settings.stackIndex + settings.stackIndexDelta
        if (checkURL(img.src)) {
          close({ error: true })
          return false
        }
        fluidBoxGhost.style.backgroundImage = `url('${formatURL(img.src)}'`
        instanceData.thumb.natW = img.naturalWidth
        instanceData.thumb.natH = img.naturalHeight
        compute()
        fluidBoxThumb.style.opacity = 0
        fluidboxOverlay.style.opacity = 1
      }
      img.onerror = function () {
        close({ error: true })
      }
      img.src = element.getAttribute('href')
    }
  }

  const compute = () => {
    let { natW, natH, w, h } = instanceData.thumb
    const thumbRatio = natW / natH
    const viewportRatio = globalData.viewport.w / globalData.viewport.h

    // Replace dimensions if maxWidth or maxHeight is declared
    if (settings.maxWidth > 0) {
      natW = settings.maxWidth
      natH = natW / thumbRatio
    } else if (settings.maxHeight > 0) {
      natH = settings.maxHeight
      natW = natH * thumbRatio
    }
    // Compare image ratio with viewport ratio
    let computedHeight, computedWidth, imgScaleY, imgScaleX, imgMinScale;
    if (viewportRatio > thumbRatio) {
      computedHeight = (natH < globalData.viewport.h) ? natH : globalData.viewport.h * settings.viewportFill;
      imgScaleY = computedHeight / h;
      imgScaleX = natW * (h * imgScaleY / natH) / w;
      imgMinScale = imgScaleY;
    } else {
      computedWidth = (natW < globalData.viewport.w) ? natW : globalData.viewport.w * settings.viewportFill;
      imgScaleX = computedWidth / w;
      imgScaleY = natH * (w * imgScaleX / natW) / h;
      imgMinScale = imgScaleX;
    }

    // Display console error if both maxHeight and maxWidth are specified
    if (settings.maxWidth && settings.maxHeight) {
      console.warn('Fluidbox: Both maxHeight and maxWidth are specified. You can only specify one. If both are specified, only the maxWidth property will be respected. This will not generate any error, but may cause unexpected sizing behavior.');
    }

    // Scale
    const { top, left } = elementPosition(fluidBoxThumb)
    const offsetY = window.scrollY - top + 0.5 * (h * (imgMinScale - 1)) + 0.5 * (globalData.viewport.h - h * imgMinScale)
    const offsetX = 0.5 * (w * (imgMinScale - 1)) + 0.5 * (globalData.viewport.w - w * imgMinScale) - left
    const scale = `${parseInt(imgScaleX * 100) / 100},${parseInt(imgScaleY * 100) / 100}`

    const { top: wrapTop, left: wrapLeft } = elementPosition(fluidBoxWrapper)
    const transformStyleString = `translate(${parseInt(offsetX * 100) / 100}px,${parseInt(offsetY * 100) / 100}px) scale(${scale})`
    fluidBoxGhost.style.transform = transformStyleString
    fluidBoxGhost.style.top = `${top - wrapTop}px`
    fluidBoxGhost.style.left = `${left - wrapLeft}px`

    if (fluidBoxLoader) {
      fluidBoxLoader.style.transform = transformStyleString
    }
  }

  const close = (d) => {
    const fluidboxOverlay = element.querySelector('.fluidbox__overlay')

    const closeData = Object.assign({}, { error: false }, d)

    // Do not do anything if Fluidbox is not opened/closed, for performance reasons
    if (instanceData.state === null || typeof instanceData.state === typeof undefined || instanceData.state === 0) {
      return false
    }
    instanceData.state = 0

    const rmClass = []
    element.classList.forEach((value) => {
      // console.log(value, value.match(/(^|\s)fluidbox--(opened|loaded|loading)+/g))
      if (value.match(/(^|\s)fluidbox--(opened|loaded|loading)+/g)) {
        rmClass.push(value)
      }
    })
    element.classList.remove(...rmClass)

    const { top: imgTop, left: imgLeft } = elementPosition(fluidBoxThumb)
    const { top: wrapTop, left: wrapLeft } = elementPosition(fluidBoxWrapper)
    const imgStyle = fluidBoxThumb.style

    fluidBoxGhost.style.transform = 'translate(0,0) scale(1,1)'
    fluidBoxGhost.style.top = `${imgTop - wrapTop + parseInt(imgStyle.borderTopWidth || 0) + parseInt(imgStyle.paddingTop || 0)}`
    fluidBoxGhost.style.left = `${imgLeft - wrapLeft + parseInt(imgStyle.borderLeftWidth || 0) + parseInt(imgStyle.paddingLeft || 0)}`

    if (fluidBoxLoader) {
      fluidBoxLoader.style.transform = 'none'
    }

    if (closeData.error) {
      hideFluidbox()
      return
    } else {
      fluidBoxGhost.addEventListener('transitionend', hideFluidbox, { once: true })
    }

    if (fluidboxOverlay) fluidboxOverlay.style.opacity = 0
  }

  function onClick (e) {
    e.preventDefault()
    e.stopPropagation()
    if (!instanceData.state || instanceData.state === 0) {
      open()
    } else {
      close()
    }
  }

  function onKeydown (e) {
    if (e.key === 'Escape') {
      close()
    }
  }

  const resizeWindow = throttle(() => {
    measure.viewport()
    measure.fluidboxElements()
    if (element.classList.contains('fluidbox--opened')) {
      compute()
    }
  }, settings.resizeThrottle)

  const bindEvents = () => {
    element.addEventListener('click', onClick)
    element.addEventListener('keydown', onKeydown)
  }

  const bindListeners = () => {
    window.addEventListener('resize', resizeWindow)

    // reposition ?? + recompute + destroy

    element.addEventListener('fluidbox-close', close)
  }

  const unbind = () => {
    window.removeEventListener('resize', resizeWindow)
    element.removeEventListener('fluidbox-close', close)
  }

  const reposition = () => {
    measure.fluidboxElements()
  }

  const destroy = () => {
    unbind()
    element.classList.forEach((value) => {
      if (value.match(/(^|\s)fluidbox[--|__]\S+/g)) {
        element.classList.remove(value)
      }
    })
    element.innerHTML = instanceData.originalNode
    element.classList.add('fluidbox--destroyed')
  }
  const getMetadata = () => {
    return instanceData
  }

  init()
  reposition()

  return {
    open,
    close,
    compute,
    destroy,
    unbind,
    reposition,
    getMetadata
  }
}

