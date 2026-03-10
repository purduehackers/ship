export type GliderSmokeOptions = {
	gridCols: number;
	gridRows: number;
	cellSize: number;
	speedMs: number;
	cellColor?: [number, number, number];
	spawnCol?: number;
	spawnRow?: number;
	spawnInterval?: number;
};

// NE glider pattern (moves +x, -y in sim = up-right on screen)
const GLIDER_NE: Array<[number, number]> = [
	[0, 0],
	[1, 0],
	[2, 0],
	[2, 1],
	[1, 2]
];

const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG_STEP = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uState;
uniform ivec2 uGridSize;
out vec4 outColor;

int cell(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= uGridSize.x || c.y >= uGridSize.y) return 0;
  return int(texelFetch(uState, c, 0).r > 0.5);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int n = 0;
  n += cell(c + ivec2(-1, -1));
  n += cell(c + ivec2( 0, -1));
  n += cell(c + ivec2( 1, -1));
  n += cell(c + ivec2(-1,  0));
  n += cell(c + ivec2( 1,  0));
  n += cell(c + ivec2(-1,  1));
  n += cell(c + ivec2( 0,  1));
  n += cell(c + ivec2( 1,  1));

  int alive = cell(c);
  int nextAlive = 0;
  if (alive == 1) {
    nextAlive = (n == 2 || n == 3) ? 1 : 0;
  } else {
    nextAlive = (n == 3) ? 1 : 0;
  }

  outColor = vec4(nextAlive == 1 ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}
`;

const FRAG_RENDER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uState;
uniform ivec2 uGridSize;
uniform float uCellPx;
uniform vec3 uCellColor;

out vec4 outColor;

void main() {
  vec2 frag = gl_FragCoord.xy;
  ivec2 cellCoord = ivec2(floor(frag / uCellPx));
  int x = cellCoord.x;
  int y = (uGridSize.y - 1) - cellCoord.y;

  if (x < 0 || y < 0 || x >= uGridSize.x || y >= uGridSize.y) {
    outColor = vec4(0.0);
    return;
  }

  float alive = texelFetch(uState, ivec2(x, y), 0).r;
  float a = step(0.5, alive);
  outColor = vec4(uCellColor, a);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
	const sh = gl.createShader(type);
	if (!sh) throw new Error('Failed to create shader');
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(sh) ?? 'Unknown error';
		gl.deleteShader(sh);
		throw new Error(log);
	}
	return sh;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string) {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
	const prog = gl.createProgram();
	if (!prog) throw new Error('Failed to create program');
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(prog) ?? 'Unknown error';
		gl.deleteProgram(prog);
		throw new Error(log);
	}
	return prog;
}

function createStateTexture(
	gl: WebGL2RenderingContext,
	cols: number,
	rows: number,
	initial?: Uint8Array
) {
	const tex = gl.createTexture();
	if (!tex) throw new Error('Failed to create texture');
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cols, rows, 0, gl.RED, gl.UNSIGNED_BYTE, initial ?? null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return tex;
}

function createFramebuffer(gl: WebGL2RenderingContext, tex: WebGLTexture) {
	const fbo = gl.createFramebuffer();
	if (!fbo) throw new Error('Failed to create framebuffer');
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return fbo;
}

/** Inject a glider pattern into the current state texture */
function spawnGlider(
	gl: WebGL2RenderingContext,
	tex: WebGLTexture,
	cols: number,
	rows: number,
	spawnX: number,
	spawnY: number
) {
	// Read current state
	const fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

	const data = new Uint8Array(cols * rows);
	gl.readPixels(0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, data);

	// Write glider cells
	for (const [dx, dy] of GLIDER_NE) {
		const x = spawnX + dx;
		const y = spawnY + dy;
		if (x >= 0 && x < cols && y >= 0 && y < rows) {
			data[y * cols + x] = 255;
		}
	}

	// Upload back
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, data);
	gl.bindTexture(gl.TEXTURE_2D, null);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.deleteFramebuffer(fbo);
}

export function initGliderSmoke(canvas: HTMLCanvasElement, opts: GliderSmokeOptions): () => void {
	const { gridCols: cols, gridRows: rows, cellSize, speedMs } = opts;
	const cellColor = opts.cellColor ?? [1, 1, 1];
	const spawnCol = opts.spawnCol ?? 5;
	const spawnRow = opts.spawnRow ?? rows - 10;
	const spawnInterval = opts.spawnInterval ?? 30;

	const gl = canvas.getContext('webgl2', {
		alpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		premultipliedAlpha: false,
		powerPreference: 'low-power'
	});
	if (!gl) return () => {};

	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const cssW = cols * cellSize;
	const cssH = rows * cellSize;
	canvas.style.width = `${cssW}px`;
	canvas.style.height = `${cssH}px`;
	canvas.width = Math.round(cssW * dpr);
	canvas.height = Math.round(cssH * dpr);

	const progStep = createProgram(gl, VERT, FRAG_STEP);
	const progRender = createProgram(gl, VERT, FRAG_RENDER);

	// Start with empty grid
	let texA = createStateTexture(gl, cols, rows);
	let texB = createStateTexture(gl, cols, rows);
	let fboA = createFramebuffer(gl, texA);
	let fboB = createFramebuffer(gl, texB);

	const vao = gl.createVertexArray();
	if (!vao) throw new Error('Failed to create VAO');
	gl.bindVertexArray(vao);
	gl.bindVertexArray(null);

	let stepCount = 0;

	function step() {
		if (!gl) return;

		// Spawn a new glider every spawnInterval steps
		if (stepCount % spawnInterval === 0) {
			spawnGlider(gl, texA, cols, rows, spawnCol, spawnRow);
		}
		stepCount++;

		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
		gl.viewport(0, 0, cols, rows);
		gl.useProgram(progStep);
		gl.bindVertexArray(vao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texA);
		gl.uniform1i(gl.getUniformLocation(progStep, 'uState'), 0);
		gl.uniform2i(gl.getUniformLocation(progStep, 'uGridSize'), cols, rows);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindVertexArray(null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		[texA, texB] = [texB, texA];
		[fboA, fboB] = [fboB, fboA];
	}

	function render() {
		if (!gl) return;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(progRender);
		gl.bindVertexArray(vao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texA);
		gl.uniform1i(gl.getUniformLocation(progRender, 'uState'), 0);
		gl.uniform2i(gl.getUniformLocation(progRender, 'uGridSize'), cols, rows);
		gl.uniform1f(gl.getUniformLocation(progRender, 'uCellPx'), cellSize * dpr);
		gl.uniform3f(
			gl.getUniformLocation(progRender, 'uCellColor'),
			cellColor[0],
			cellColor[1],
			cellColor[2]
		);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindVertexArray(null);
	}

	render();

	let isTabVisible = !document.hidden;
	let lastStepTime = 0;
	let animationId: number | null = null;
	let stopped = false;

	const handleVisibility = () => {
		isTabVisible = !document.hidden;
	};
	document.addEventListener('visibilitychange', handleVisibility);

	const loop = (timestamp: number) => {
		if (stopped) return;
		if (isTabVisible && timestamp - lastStepTime >= speedMs) {
			step();
			render();
			lastStepTime = timestamp;
		}
		animationId = requestAnimationFrame(loop);
	};
	animationId = requestAnimationFrame(loop);

	return () => {
		stopped = true;
		if (animationId !== null) cancelAnimationFrame(animationId);
		document.removeEventListener('visibilitychange', handleVisibility);
		gl.deleteVertexArray(vao);
		gl.deleteFramebuffer(fboA);
		gl.deleteFramebuffer(fboB);
		gl.deleteTexture(texA);
		gl.deleteTexture(texB);
		gl.deleteProgram(progStep);
		gl.deleteProgram(progRender);
	};
}
