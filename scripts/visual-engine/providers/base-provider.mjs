/**
 * Interfaz base para proveedores visuales del Visual Asset Engine.
 * Mantiene a LandingFactory desacoplada de Recraft.
 */
export class BaseVisualProvider {
  getName() {
    throw new Error('getName() debe ser implementado por el proveedor');
  }

  validateConfig() {
    throw new Error('validateConfig() debe ser implementado por el proveedor');
  }

  async getAccountInfo() {
    throw new Error('getAccountInfo() debe ser implementado por el proveedor');
  }

  async generate() {
    throw new Error('generate() debe ser implementado por el proveedor');
  }

  async createStyle() {
    throw new Error('createStyle() debe ser implementado por el proveedor');
  }

  async listStyles() {
    throw new Error('listStyles() debe ser implementado por el proveedor');
  }

  async imageToImage() {
    throw new Error('imageToImage() debe ser implementado por el proveedor');
  }
}
