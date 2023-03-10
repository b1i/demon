class demon {
  constructor(canvas) {
    this.canvas = document.querySelector(canvas)
    this.ctx = this.canvas.getContext("2d")

    this.canvas.width = 2000
    this.canvas.height = (2000 / window.innerWidth) * window.innerHeight

    this.camera = { x: 0, y: 0, z: 0, rotation: { x: 0, y: 0, z: 0 }, fov: 90 }
    this.objects = []

    this.darkmode = false
    this.wireframe = false
    this.fill = true
    this.mouseX = []
    this.mouseY = []
    this.keys = []
    document.addEventListener("keydown", (e) => {
      e.preventDefault()
      this.keys[e.key] = true
    })
    document.addEventListener("keyup", (e) => {
      e.preventDefault()
      delete this.keys[e.key]
    })
    this.canvas.addEventListener("mousedown", (event) => {
      this.isMouseDown = true
      this.mouseX = event.clientX
      this.mouseY = event.clientY
    })

    this.canvas.addEventListener("mousemove", (event) => {
      if (!this.isMouseDown) {
        return
      }

      const deltaX = event.clientX - this.mouseX
      const deltaY = event.clientY - this.mouseY
      this.camera.rotation.x += deltaY * 0.01
      this.camera.rotation.y += deltaX * 0.01
      this.mouseX = event.clientX
      this.mouseY = event.clientY
    })

    this.canvas.addEventListener("mouseup", () => {
      this.isMouseDown = false
    })
  }

  load(name, x, y, z, color) {
    let vertices = []
    let faces = []

    fetch(name)
      .then((res) => res.text())
      .then((data) => {
        let lines = data.split("\n")

        for (let line of lines) {
          line = line.split(" ")

          for (let i = 0; i < line.length; i++) {
            line[i] = line[i].trim()

            if (line[i] === "") {
              line.splice(i, 1)
              i--
            }
          }

          switch (line[0]) {
            case "v":
              vertices.push({ x: line[1] * 1, y: line[2] * 1, z: line[3] * 1 })
              break
            case "f":
              let arr = []
              for (let i = 1; i < line.length; i++) {
                arr.push(vertices[line[i].split("/")[0] - 1])
              }
              faces.push(arr)
              break
          }
        }
      })

    let object = {
      shape: "polyhedron",
      faces,
      x: x || 0,
      y: y || 0,
      z: z || 0,
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        center: { x: x || 0, y: y || 0, z: z || 0 },
      },
      color: color || "white",
    }
    this.objects.push(object)

    return object
  }

  renderLoop(beforeRender) {
    let rsThis = this

    function run() {
      beforeRender()
      rsThis.render()
      window.requestAnimationFrame(run)
    }

    window.requestAnimationFrame(run)
  }

  toDeg(rad) {
    return (180 * rad) / Math.PI
  }
  toRad(deg) {
    return (Math.PI * deg) / 180
  }

  spaceToPixels(x, y, z) {
    let cw = this.canvas.width
    let ch = this.canvas.height
    let fovX = this.toRad(this.camera.fov)
    let fovY = 2 * Math.atan((Math.tan(fovX / 2) * ch) / cw)
    let width = Math.tan(fovX / 2) * z * 2
    let height = Math.tan(fovY / 2) * z * 2

    let ex = (x / width) * this.canvas.width
    let ey = (y / height) * this.canvas.height

    if (z < 0) {
      let ratio

      if (ex > 0) ratio = this.canvas.width / 2 / ex
      if (ex < 0) ratio = -(this.canvas.width / 2) / ex

      ex *= -1 * ratio
      ey *= -1 * ratio
    }

    return { x: ex, y: ey, z }
  }


  drawShape(points, stroke, fill) {
  
    if (points.reduce((a, c) => a && c.z < 0, true)) {
      return
    }

    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }

    this.ctx.lineTo(points[0].x, points[0].y)
    this.ctx.closePath()

    if (stroke) this.ctx.stroke()
    if (fill) this.ctx.fill()
  }

  render() {
  
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2)
    this.ctx.scale(1, -1)
    this.ctx.clearRect(
      -this.canvas.width / 2,
      -this.canvas.height / 2,
      this.canvas.width,
      this.canvas.height
    )

    if (this.darkmode) {
      this.ctx.fillStyle = "#111111"
      this.ctx.strokeStyle = "#ffffff"
      this.ctx.fillRect(
        -this.canvas.width / 2,
        -this.canvas.height / 2,
        this.canvas.width,
        this.canvas.height
      )
    }

 
    this.objects.sort((a, b) => {
      let ad = this.distanceFromCamera(a.x, a.y, a.z)
      let bd = this.distanceFromCamera(b.x, b.y, b.z)
      return bd - ad
    })

    function applyMatrices(point, rotation, x, y, z) {
      let part1 = JSON.parse(JSON.stringify(point))
      part1.y =
        (point.y + y - rotation.center.y) * Math.cos(rotation.x) +
        (point.z + z - rotation.center.z) * -Math.sin(rotation.x)
      part1.z =
        (point.y + y - rotation.center.y) * Math.sin(rotation.x) +
        (point.z + z - rotation.center.z) * Math.cos(rotation.x)

      let part2 = JSON.parse(JSON.stringify(part1))
      part2.z =
        (part1.x + x - rotation.center.x) * -Math.sin(rotation.y) +
        (part1.z + z - rotation.center.z) * Math.cos(rotation.y) +
        z
      part2.x =
        (part1.x + x - rotation.center.x) * Math.cos(rotation.y) +
        (part1.z + z - rotation.center.z) * Math.sin(rotation.y)

      let final = JSON.parse(JSON.stringify(part2))
      final.x =
        (part2.x + x - rotation.center.x) * Math.cos(rotation.z) +
        (part2.y + y - rotation.center.y) * -Math.sin(rotation.z) +
        x
      final.y =
        (part2.x + x - rotation.center.x) * Math.sin(rotation.z) +
        (part2.y + y - rotation.center.y) * Math.cos(rotation.z) +
        y

      return final
    }

    for (let object of this.objects) {
      let objectFaces = JSON.parse(JSON.stringify(object.faces))

      objectFaces.forEach((face, index) => {
        face.forEach((point, index) => {
          let nPoint = applyMatrices(
            point,
            object.rotation,
            object.x,
            object.y,
            object.z
          )
          face[index] = nPoint
        })
        objectFaces[index] = face
      })

      objectFaces.sort((a, b) => {
        let aTotal = a.reduce((a, c) => a + c.z, 0)
        let bTotal = b.reduce((a, c) => a + c.z, 0)
        return bTotal - aTotal
      })

      for (let face of objectFaces) {
        let l1 = {
          x: face[1].x - face[0].x,
          y: face[1].y - face[0].y,
          z: face[1].z - face[0].z,
        }
        let l2 = {
          x: face[2].x - face[0].x,
          y: face[2].y - face[0].y,
          z: face[2].z - face[0].z,
        }

        let normal = {
          x: l1.y * l2.z - l1.z * l2.y,
          y: l1.z * l2.x - l1.x * l2.z,
          z: l1.x * l2.y - l1.y * l2.x,
        }

        let ax = normal.x * (face[0].x - this.camera.x)
        let ay = normal.y * (face[0].y - this.camera.y)
        let az = normal.z * (face[0].z - this.camera.z)

        if (ax + ay + az < 0) {
          let pointArr = []

          face.forEach((a) => {
            let nPoint = this.spaceToPixels(
              a.x - this.camera.x,
              a.y - this.camera.y,
              a.z - this.camera.z
            )
            pointArr.push(nPoint)
          })

          this.ctx.fillStyle = object.color
          this.drawShape(pointArr, this.wireframe, this.fill)
        }
      }
    }
  }
}
