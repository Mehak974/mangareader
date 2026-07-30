describe('Manga Reader E2E', () => {
  it('should load the homepage', () => {
    cy.visit('/');
    cy.contains('Read Manga Free Online');
  });

  it('should navigate to the blog', () => {
    cy.visit('/blog');
    cy.contains('Blog');
  });
});
